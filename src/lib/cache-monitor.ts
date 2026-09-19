/**
 * Cache Monitoring & Health Check
 * Provides insight into Redis cache performance and health
 */

import { getRedisClient } from "@/lib/cache";
import type { RedisClientType } from "redis";
import type { Redis as UpstashRedis } from "@upstash/redis";
import { logger } from "@/lib/logger";

export interface CacheHealth {
  isHealthy: boolean;
  connected: boolean;
  totalKeys: number;
  memoryUsed?: number;
  memoryMax?: number;
  memoryUtilization?: number;
  timestamp: Date;
  error?: string;
}

export interface CacheStatistics {
  totalKeys: number;
  estimatedMemoryUsage: number;
  commonPrefixes: Record<string, number>;
}

/**
 * Check Redis cache health
 */
export async function checkCacheHealth(): Promise<CacheHealth> {
  try {
    const client = await getRedisClient();

    if (!client) {
      return {
        isHealthy: false,
        connected: false,
        totalKeys: 0,
        timestamp: new Date(),
        error: "Redis client not available",
      };
    }

    // Check if client is Upstash or traditional Redis
    const isUpstash = !("isOpen" in client);
    const redisClient = isUpstash ? null : (client as RedisClientType);
    const upstashClient = isUpstash ? (client as UpstashRedis) : null;

    // Get number of keys in database
    let totalKeys = 0;
    try {
      if (upstashClient) {
        totalKeys = await upstashClient.dbsize();
      } else if (redisClient) {
        totalKeys = await redisClient.dbSize();
      }
    } catch (e) {
      logger.warn("Could not fetch key count:", e);
    }

    // Get memory info (only available for traditional Redis)
    let memoryInfo: any = {};
    if (redisClient) {
      try {
        const infoResponse = await redisClient.info("memory");
        // Parse INFO response (format: key:value\r\n)
        if (infoResponse) {
          const lines = infoResponse.split("\r\n");
          lines.forEach((line: string) => {
            const [key, value] = line.split(":");
            if (key && value) {
              memoryInfo[key] = value;
            }
          });
        }
      } catch (e) {
        logger.warn("Could not fetch memory info:", e);
      }
    }

    return {
      isHealthy: true,
      connected: redisClient ? redisClient.isOpen : true,
      totalKeys,
      memoryUsed: memoryInfo["used_memory"]
        ? Number.parseInt(memoryInfo["used_memory"])
        : undefined,
      memoryMax: memoryInfo["maxmemory"] ? Number.parseInt(memoryInfo["maxmemory"]) : undefined,
      memoryUtilization:
        memoryInfo["used_memory"] && memoryInfo["maxmemory"]
          ? (Number.parseInt(memoryInfo["used_memory"]) /
              Number.parseInt(memoryInfo["maxmemory"])) *
            100
          : undefined,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error("Cache health check failed:", error);
    return {
      isHealthy: false,
      connected: false,
      totalKeys: 0,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStatistics(): Promise<CacheStatistics | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const isUpstash = !("isOpen" in client);
    const redisClient = isUpstash ? null : (client as RedisClientType);
    const upstashClient = isUpstash ? (client as UpstashRedis) : null;

    let totalKeys = 0;
    try {
      if (upstashClient) {
        totalKeys = await upstashClient.dbsize();
      } else if (redisClient) {
        totalKeys = await redisClient.dbSize();
      }
    } catch (e) {
      logger.warn("Could not fetch key count:", e);
    }

    // Get all keys to analyze patterns
    const keys = await client.keys("*");

    // Group keys by prefix
    const prefixes: Record<string, number> = {};
    keys.forEach((key: string) => {
      const prefix = key.split(":")[0];
      prefixes[prefix] = (prefixes[prefix] || 0) + 1;
    });

    // Estimate memory usage (rough approximation)
    let estimatedMemory = 0;
    for (const key of keys) {
      if (redisClient) {
        try {
          const memory = await redisClient.memoryUsage(key);
          estimatedMemory += memory || 50;
        } catch (e) {
          // MEMORY command might not be available, use fallback
          logger.warn(`Could not get memory for key ${key}:`, e);
          estimatedMemory += 50 + key.length;
        }
      } else {
        // Fallback estimation for Upstash
        estimatedMemory += 50 + key.length;
      }
    }

    return {
      totalKeys,
      estimatedMemoryUsage: estimatedMemory,
      commonPrefixes: prefixes,
    };
  } catch (error) {
    logger.error("Failed to get cache statistics:", error);
    return null;
  }
}

/**
 * Log cache health status
 */
export async function logCacheStatus(): Promise<void> {
  const health = await checkCacheHealth();
  const stats = await getCacheStatistics();

  logger.info("\n📊 === Cache Health Status ===");
  logger.info(`✅ Connected: ${health.connected}`);
  logger.info(`📦 Total Keys: ${health.totalKeys}`);

  if (health.memoryUsed && health.memoryMax) {
    const memoryMB = (health.memoryUsed / 1024 / 1024).toFixed(2);
    const maxMB = (health.memoryMax / 1024 / 1024).toFixed(2);
    logger.info(`💾 Memory: ${memoryMB}MB / ${maxMB}MB (${health.memoryUtilization?.toFixed(2)}%)`);
  }

  if (stats) {
    logger.info("\n📈 Cache Statistics:");
    logger.info(`  Common Prefixes: ${JSON.stringify(stats.commonPrefixes, null, 2)}`);
  }

  if (health.error) {
    logger.error(`❌ Error: ${health.error}`);
  }
  logger.info("");
}

/**
 * Monitor cache health periodically
 * Useful for production monitoring
 */
export function startCacheHealthMonitor(
  intervalMs: number = 60000,
  threshold: number = 80
): NodeJS.Timeout {
  return setInterval(async () => {
    const health = await checkCacheHealth();

    if (!health.isHealthy) {
      logger.error("🚨 Redis cache unhealthy!", health.error);
    }

    if (health.memoryUtilization && health.memoryUtilization > threshold) {
      logger.warn(`⚠️ Redis memory usage high: ${health.memoryUtilization.toFixed(2)}%`);
    }
  }, intervalMs);
}

/**
 * Get formatted memory size
 */
function formatMemorySize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

/**
 * Print detailed cache report
 */
export async function printCacheReport(): Promise<void> {
  logger.info("\n");
  logger.info("╔══════════════════════════════════════════╗");
  logger.info("║         REDIS CACHE REPORT               ║");
  logger.info("╚══════════════════════════════════════════╝");

  const health = await checkCacheHealth();
  const stats = await getCacheStatistics();

  logger.info(`\n📊 Health Status:`);
  logger.info(`   Connected: ${health.connected ? "✅ Yes" : "❌ No"}`);
  logger.info(`   Healthy: ${health.isHealthy ? "✅ Yes" : "❌ No"}`);
  logger.info(`   Total Keys: ${health.totalKeys}`);

  if (health.memoryUsed) {
    logger.info(`\n💾 Memory Usage:`);
    logger.info(`   Used: ${formatMemorySize(health.memoryUsed)}`);
    if (health.memoryMax) {
      logger.info(`   Max: ${formatMemorySize(health.memoryMax)}`);
      logger.info(`   Utilization: ${health.memoryUtilization?.toFixed(2)}%`);
    }
  }

  if (stats) {
    logger.info(`\n📈 Key Distribution:`);
    const sorted = Object.entries(stats.commonPrefixes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    sorted.forEach(([prefix, count]) => {
      logger.info(`   ${prefix}: ${count} keys`);
    });
  }

  logger.info("\n");
}
