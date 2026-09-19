import { createClient, type RedisClientType } from "redis";
import { Redis as UpstashRedis } from "@upstash/redis";
import superjson from "superjson";
import { logger } from "@/lib/logger";

let redisClient: RedisClientType | UpstashRedis | null = null;
let isUpstash = false;

const CACHE_KEYS = {
  // User cache
  USER: (id: string) => `user:${id}`,
  USER_BY_EMAIL: (email: string) => `user:email:${email}`,
  USER_PROFILE: (id: string) => `user:profile:${id}`,

  // Session cache
  SESSION: (token: string) => `session:${token}`,

  // Service cache
  SERVICE_TYPES: "service:types:all",
  SERVICE_TYPE: (id: string) => `service:type:${id}`,

  // Package cache
  PACKAGES: "package:all",
  PACKAGE: (id: string) => `package:${id}`,

  // Provider cache
  PROVIDER_PROFILE: (userId: string) => `provider:profile:${userId}`,
  PROVIDER_STATS: (userId: string) => `provider:stats:${userId}`,

  // Subscription cache
  SUBSCRIPTION: (userId: string) => `subscription:${userId}`,
  USER_CREDITS: (userId: string) => `user:credits:${userId}`,

  // Notification cache
  NOTIFICATIONS: (userId: string) => `notifications:${userId}`,
  UNREAD_COUNT: (userId: string) => `unread:count:${userId}`,

  // Request cache
  REQUEST: (id: string) => `request:${id}`,
  REQUEST_LIST: (userId: string, type: "client" | "provider") => `request:list:${userId}:${type}`,
} as const;

const CACHE_TTL = {
  SESSION: 86400, // 24 hours
  USER: 3600, // 1 hour
  PROFILE: 1800, // 30 minutes
  SERVICE_TYPES: 86400, // 24 hours
  PACKAGES: 21600, // 6 hours
  SUBSCRIPTION: 300, // 5 minutes
  NOTIFICATIONS: 300, // 5 minutes
  REQUEST: 600, // 10 minutes
  REQUEST_LIST: 300, // 5 minutes
} as const;

export async function getRedisClient(): Promise<RedisClientType | UpstashRedis | null> {
  if (redisClient) {
    // For Upstash, no need to check connection status
    if (isUpstash) return redisClient;
    // For traditional Redis, check if still connected
    if ((redisClient as RedisClientType).isOpen) {
      return redisClient;
    }
  }

  // Check for Upstash Redis REST - Priority 1
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      redisClient = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      isUpstash = true;
      logger.info("✅ Upstash Redis connected (serverless mode)");
      return redisClient;
    } catch (error) {
      logger.error("Failed to connect to Upstash Redis:", error);
      return null;
    }
  }

  // Traditional Redis (Local/Railway/Redis Cloud) - Priority 2
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    logger.warn("Redis not configured. Caching disabled.");
    return null;
  }

  try {
    redisClient = createClient({
      url:
        process.env.REDIS_URL ||
        `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error("Redis reconnection failed after 10 attempts");
            return new Error("Redis reconnection failed");
          }
          return retries * 100;
        },
      },
    });

    redisClient.on("error", (err: Error) => {
      logger.error("Redis error:", err);
      redisClient = null;
    });

    redisClient.on("connect", () => {
      logger.info("✅ Traditional Redis connected");
    });

    await redisClient.connect();
    isUpstash = false;
    return redisClient;
  } catch (error) {
    logger.error("Failed to connect to Redis:", error);
    return null;
  }
}

/**
 * Get value from cache
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const data = await client.get(key);
    if (!data) return null;

    // Upstash may return already-parsed objects; traditional Redis returns strings.
    if (typeof data === "string") {
      try {
        return superjson.parse(data) as T;
      } catch {
        return JSON.parse(data) as T;
      }
    }

    // Legacy Upstash plain JSON objects
    return data as T;
  } catch (error) {
    logger.error(`Cache get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set value in cache with TTL
 */
export async function setCached<T>(key: string, value: T, ttl?: number): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    // Persist via SuperJSON so Date/etc. revive correctly on read
    const serialized = superjson.stringify(value);

    if (isUpstash) {
      if (ttl) {
        await (client as UpstashRedis).set(key, serialized, { ex: ttl });
      } else {
        await (client as UpstashRedis).set(key, serialized);
      }
    } else {
      if (ttl) {
        await (client as RedisClientType).setEx(key, ttl, serialized);
      } else {
        await (client as RedisClientType).set(key, serialized);
      }
    }
  } catch (error) {
    logger.error(`Cache set error for key ${key}:`, error);
  }
}

/**
 * Delete value from cache
 */
export async function deleteCached(key: string | string[]): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    const keys = Array.isArray(key) ? key : [key];

    if (isUpstash) {
      // Upstash del accepts multiple string arguments
      await (client as UpstashRedis).del(...keys);
    } else {
      // Traditional Redis del accepts array
      await (client as RedisClientType).del(keys);
    }
  } catch (error) {
    logger.error(`Cache delete error:`, error);
  }
}

/**
 * Delete all keys matching pattern (SCAN — never KEYS on production Redis).
 */
export async function deleteCachedPattern(pattern: string): Promise<void> {
  try {
    const client = await getRedisClient();
    if (!client) return;

    if (isUpstash) {
      const keys = await (client as UpstashRedis).keys(pattern);
      if (keys.length > 0) {
        await (client as UpstashRedis).del(...keys);
      }
      return;
    }

    const redis = client as RedisClientType;
    let cursor = "0";
    const matched: string[] = [];
    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = String(result.cursor);
      matched.push(...result.keys);
    } while (cursor !== "0");

    if (matched.length > 0) {
      await redis.del(matched);
    }
  } catch (error) {
    logger.error(`Cache pattern delete error:`, error);
  }
}

/**
 * Increment counter (useful for unread counts)
 */
export async function incrementCached(key: string, increment = 1): Promise<number> {
  try {
    const client = await getRedisClient();
    if (!client) return 0;

    if (isUpstash) {
      // Upstash uses incrby (lowercase)
      return await (client as UpstashRedis).incrby(key, increment);
    } else {
      return await (client as RedisClientType).incrBy(key, increment);
    }
  } catch (error) {
    logger.error(`Cache increment error for key ${key}:`, error);
    return 0;
  }
}

/**
 * Get or set value (cache-aside pattern). Always returns fetcher data on miss/error.
 */
export async function getOrSetCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  try {
    const cached = await getCached<T>(key);
    if (cached !== null && cached !== undefined) return cached;
  } catch (error) {
    logger.error(`Cache get-or-set read error for key ${key}:`, error);
  }

  const data = await fetcher();
  try {
    if (data !== null && data !== undefined) {
      await setCached(key, data, ttl);
    }
  } catch (error) {
    logger.error(`Cache get-or-set write error for key ${key}:`, error);
  }
  return data;
}

export const cacheKeys = CACHE_KEYS;
export const cacheTTL = CACHE_TTL;
