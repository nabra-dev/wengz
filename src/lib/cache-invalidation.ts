/**
 * Cache Invalidation Helper
 * Centralizes cache invalidation logic to ensure consistency
 * across mutations and database updates
 */

import { deleteCached, deleteCachedPattern, cacheKeys } from "@/lib/cache";
import { logger } from "@/lib/logger";

/**
 * Invalidate all user-related cache entries
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await deleteCached([
    cacheKeys.USER(userId),
    cacheKeys.USER_PROFILE(userId),
    cacheKeys.USER_CREDITS(userId),
    cacheKeys.SUBSCRIPTION(userId),
  ]);
}

/**
 * Invalidate package list cache
 * Call this when packages are created, updated, or deleted
 */
export async function invalidatePackageCache(): Promise<void> {
  await deleteCached(cacheKeys.PACKAGES);
}

/**
 * Invalidate service types cache
 * Call this when service types are created, updated, or deleted
 */
export async function invalidateServiceTypesCache(): Promise<void> {
  await deleteCached(cacheKeys.SERVICE_TYPES);
}

/**
 * Invalidate specific service type cache
 */
export async function invalidateServiceTypeCache(serviceTypeId: string): Promise<void> {
  await deleteCached([
    cacheKeys.SERVICE_TYPE(serviceTypeId),
    cacheKeys.SERVICE_TYPES, // Also invalidate the list
  ]);
}

/**
 * Invalidate all notification cache for a user
 */
export async function invalidateNotificationsCache(userId: string): Promise<void> {
  await deleteCached([cacheKeys.NOTIFICATIONS(userId), cacheKeys.UNREAD_COUNT(userId)]);
}

/**
 * Invalidate specific request cache
 */
export async function invalidateRequestCache(requestId: string, userId?: string): Promise<void> {
  await deleteCached(cacheKeys.REQUEST(requestId));

  // If userId is provided, also invalidate the user's request list
  if (userId) {
    await deleteCachedPattern(`request:list:${userId}:*`);
  }
}

/**
 * Invalidate provider profile and stats
 */
export async function invalidateProviderCache(userId: string): Promise<void> {
  await deleteCached([cacheKeys.PROVIDER_PROFILE(userId), cacheKeys.PROVIDER_STATS(userId)]);
}

/**
 * Invalidate subscription cache for user
 */
export async function invalidateSubscriptionCache(userId: string): Promise<void> {
  await deleteCached([cacheKeys.SUBSCRIPTION(userId), cacheKeys.USER_CREDITS(userId)]);
}

/**
 * Comprehensive cache clear - use sparingly
 * Clears multiple related caches for complex operations
 */
export async function invalidateMultipleUserCaches(userIds: string[]): Promise<void> {
  const keysToDelete: string[] = [];

  for (const userId of userIds) {
    keysToDelete.push(
      cacheKeys.USER(userId),
      cacheKeys.USER_PROFILE(userId),
      cacheKeys.USER_CREDITS(userId),
      cacheKeys.SUBSCRIPTION(userId),
      cacheKeys.NOTIFICATIONS(userId),
      cacheKeys.UNREAD_COUNT(userId)
    );
  }

  await deleteCached(keysToDelete);
}

/**
 * Invalidate all request-related caches for both client and provider
 */
export async function invalidateRequestCacheFull(
  requestId: string,
  clientId?: string,
  providerId?: string
): Promise<void> {
  const keysToDelete: string[] = [cacheKeys.REQUEST(requestId)];

  if (clientId) {
    keysToDelete.push(cacheKeys.REQUEST_LIST(clientId, "client"));
  }

  if (providerId) {
    keysToDelete.push(cacheKeys.REQUEST_LIST(providerId, "provider"));
  }

  await deleteCached(keysToDelete);
}

/**
 * Debug helper - clear ALL cache
 * WARNING: Only use in development or for emergency situations
 */
export async function clearAllCache(): Promise<void> {
  logger.warn("⚠️ Clearing ALL Redis cache - this should only be used in development");
  await deleteCachedPattern("*");
}
