import { createClient, type RedisClientType } from "redis";
import { Redis as UpstashRedis } from "@upstash/redis";
import superjson from "superjson";
import { logger } from "@/lib/logger";

let redisClient: RedisClientType | UpstashRedis | null = null;
let isUpstash = false;
/** When Redis is unreachable, skip reconnect attempts until this timestamp. */
let circuitOpenUntil = 0;
let connectInFlight: Promise<RedisClientType | UpstashRedis | null> | null = null;

const CIRCUIT_COOLDOWN_MS = 30_000;
const CONNECT_TIMEOUT_MS = 400;

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

function openCircuit() {
  circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  redisClient = null;
  connectInFlight = null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function getRedisClient(): Promise<RedisClientType | UpstashRedis | null> {
  if (Date.now() < circuitOpenUntil) {
    return null;
  }

  if (redisClient) {
    if (isUpstash) return redisClient;
    if ((redisClient as RedisClientType).isOpen) {
      return redisClient;
    }
    redisClient = null;
  }

  if (connectInFlight) return connectInFlight;

  connectInFlight = connectRedis().finally(() => {
    connectInFlight = null;
  });
  return connectInFlight;
}

async function connectRedis(): Promise<RedisClientType | UpstashRedis | null> {
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
      openCircuit();
      return null;
    }
  }

  // Traditional Redis (Local/Railway/Redis Cloud) - Priority 2
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    return null;
  }

  try {
    const client = createClient({
      url:
        process.env.REDIS_URL ||
        `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`,
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: false,
      },
    });

    client.on("error", (err: Error) => {
      logger.error("Redis error:", err);
      openCircuit();
    });

    await withTimeout(client.connect(), CONNECT_TIMEOUT_MS + 200, "Redis connect");
    redisClient = client as RedisClientType;
    isUpstash = false;
    logger.info("✅ Traditional Redis connected");
    return redisClient;
  } catch (error) {
    logger.warn("Redis unavailable — caching disabled for 30s", {
      error: error instanceof Error ? error.message : String(error),
    });
    openCircuit();
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

    const data = await withTimeout(Promise.resolve(client.get(key)), 300, `cache get ${key}`);
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
    openCircuit();
    logger.warn(`Cache get skipped for key ${key}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
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

    const write = isUpstash
      ? ttl
        ? (client as UpstashRedis).set(key, serialized, { ex: ttl })
        : (client as UpstashRedis).set(key, serialized)
      : ttl
        ? (client as RedisClientType).setEx(key, ttl, serialized)
        : (client as RedisClientType).set(key, serialized);

    await withTimeout(Promise.resolve(write), 300, `cache set ${key}`);
  } catch (error) {
    openCircuit();
    logger.warn(`Cache set skipped for key ${key}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
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

    const del = isUpstash
      ? (client as UpstashRedis).del(...keys)
      : (client as RedisClientType).del(keys);

    await withTimeout(Promise.resolve(del), 300, "cache delete");
  } catch (error) {
    openCircuit();
    logger.warn(`Cache delete skipped:`, {
      error: error instanceof Error ? error.message : String(error),
    });
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
    openCircuit();
    logger.warn(`Cache pattern delete skipped:`, {
      error: error instanceof Error ? error.message : String(error),
    });
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
      return await (client as UpstashRedis).incrby(key, increment);
    } else {
      return await (client as RedisClientType).incrBy(key, increment);
    }
  } catch (error) {
    openCircuit();
    logger.warn(`Cache increment skipped for key ${key}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Get or set value (cache-aside pattern). Always returns fetcher data on miss/error.
 * Never blocks the request on a dead Redis — fail open to the fetcher.
 */
export async function getOrSetCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  try {
    const cached = await getCached<T>(key);
    if (cached !== null && cached !== undefined) return cached;
  } catch {
    // ignore — fall through to fetcher
  }

  const data = await fetcher();
  // Fire-and-forget write so a slow Redis never delays the response
  if (data !== null && data !== undefined) {
    void setCached(key, data, ttl);
  }
  return data;
}

export const cacheKeys = CACHE_KEYS;
export const cacheTTL = CACHE_TTL;
