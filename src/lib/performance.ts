import { logger } from "@/lib/logger";
/**
 * Performance monitoring and metrics collection
 * Tracks API performance, cache efficiency, and database query times
 */

interface PerformanceMetrics {
  requestCount: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  dbQueries: number;
}

class PerformanceMonitor {
  private readonly metrics = new Map<string, PerformanceMetrics>();
  private readonly queryTimings = new Map<string, number[]>();
  private cacheStats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Record query execution time
   */
  recordQuery(operation: string, duration: number) {
    if (!this.queryTimings.has(operation)) {
      this.queryTimings.set(operation, []);
    }
    this.queryTimings.get(operation)!.push(duration);
  }

  /**
   * Record API endpoint performance
   */
  recordApiCall(
    endpoint: string,
    duration: number,
    success: boolean = true,
    metadata?: { dbQueries?: number; cacheHit?: boolean }
  ) {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, {
        requestCount: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: -Infinity,
        errorCount: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheHitRate: 0,
        dbQueries: 0,
      });
    }

    const metric = this.metrics.get(endpoint)!;
    metric.requestCount += 1;
    metric.totalTime += duration;
    metric.avgTime = metric.totalTime / metric.requestCount;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);

    if (!success) {
      metric.errorCount += 1;
    }

    if (metadata?.cacheHit) {
      metric.cacheHits += 1;
    } else if (metadata?.cacheHit === false) {
      metric.cacheMisses += 1;
    }

    if (metric.cacheHits + metric.cacheMisses > 0) {
      metric.cacheHitRate = metric.cacheHits / (metric.cacheHits + metric.cacheMisses);
    }

    if (metadata?.dbQueries) {
      metric.dbQueries += metadata.dbQueries;
    }
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheStats.hits += 1;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheStats.misses += 1;
  }

  /**
   * Get metrics for specific endpoint
   */
  getMetrics(endpoint: string): PerformanceMetrics | null {
    return this.metrics.get(endpoint) ?? null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, PerformanceMetrics> {
    const result: Record<string, PerformanceMetrics> = {};
    for (const [endpoint, metrics] of this.metrics) {
      result[endpoint] = metrics;
    }
    return result;
  }

  /**
   * Get query performance stats
   */
  getQueryStats() {
    const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    for (const [operation, timings] of this.queryTimings) {
      const sorted = [...timings].sort((a, b) => a - b);
      stats[operation] = {
        count: timings.length,
        avg: timings.reduce((a, b) => a + b, 0) / timings.length,
        min: sorted.at(0) ?? 0,
        max: sorted.at(-1) ?? 0,
      };
    }
    return stats;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate: total > 0 ? (this.cacheStats.hits / total) * 100 : 0,
      total,
    };
  }

  /**
   * Get slowest endpoints
   */
  getSlowestEndpoints(limit = 10): Array<[string, number]> {
    return Array.from(this.metrics.entries())
      .map(([endpoint, metrics]) => [endpoint, metrics.avgTime] as [string, number])
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  /**
   * Get endpoints with highest error rates
   */
  getHighErrorRateEndpoints(limit = 10, threshold = 0.05): Array<[string, number]> {
    return Array.from(this.metrics.entries())
      .map(
        ([endpoint, metrics]) =>
          [endpoint, metrics.errorCount / metrics.requestCount] as [string, number]
      )
      .filter(([_, rate]) => rate >= threshold)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  /**
   * Reset metrics (useful for daily snapshots)
   */
  reset() {
    this.metrics.clear();
    this.queryTimings.clear();
    this.cacheStats = { hits: 0, misses: 0 };
  }

  /**
   * Get summary report
   */
  getSummary() {
    const allMetrics = this.getAllMetrics();
    const totalRequests = Object.values(allMetrics).reduce((sum, m) => sum + m.requestCount, 0);
    const totalErrors = Object.values(allMetrics).reduce((sum, m) => sum + m.errorCount, 0);
    const avgResponse =
      totalRequests > 0
        ? Object.values(allMetrics).reduce((sum, m) => sum + m.totalTime, 0) / totalRequests
        : 0;

    return {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      avgResponseTime: avgResponse,
      cacheStats: this.getCacheStats(),
      slowestEndpoints: this.getSlowestEndpoints(5),
      highErrorRateEndpoints: this.getHighErrorRateEndpoints(5),
    };
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Middleware to measure endpoint performance
 */
export function measurePerformance(endpoint: string) {
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      performanceMonitor.recordApiCall(endpoint, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      performanceMonitor.recordApiCall(endpoint, duration, false);
      throw error;
    }
  };
}

/**
 * Quick performance measurement for any async function
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  onComplete?: (duration: number) => void
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    if (onComplete) onComplete(duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`${label} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Log performance metrics periodically
 */
export function logPerformanceMetrics(interval = 60000) {
  setInterval(() => {
    const summary = performanceMonitor.getSummary();
    logger.info("=== Performance Summary ===");
    logger.info(`Total Requests: ${summary.totalRequests}`);
    logger.info(`Error Rate: ${summary.errorRate.toFixed(2)}%`);
    logger.info(`Avg Response: ${summary.avgResponseTime.toFixed(2)}ms`);
    logger.info(`Cache Hit Rate: ${summary.cacheStats.hitRate.toFixed(2)}%`);

    if (summary.slowestEndpoints.length > 0) {
      logger.info("Slowest Endpoints:");
      summary.slowestEndpoints.forEach(([endpoint, time]) => {
        logger.info(`  ${endpoint}: ${time.toFixed(2)}ms`);
      });
    }

    if (summary.highErrorRateEndpoints.length > 0) {
      logger.info("High Error Rate Endpoints:");
      summary.highErrorRateEndpoints.forEach(([endpoint, rate]) => {
        logger.info(`  ${endpoint}: ${(rate * 100).toFixed(2)}%`);
      });
    }
  }, interval);
}
