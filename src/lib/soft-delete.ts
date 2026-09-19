/**
 * Soft Delete Utilities
 * 
 * Provides helper functions for soft delete operations across the system.
 * Soft deletes mark records as deleted without removing them from the database,
 * allowing for data recovery and historical tracking.
 */

import { db } from "@/lib/db";

/**
 * Soft delete a user account
 * Admin action: hides user from listings and prevents login
 */
export async function softDeleteUser(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      // Clear auth tokens to force logout
      sessions: {
        deleteMany: {},
      },
      accounts: {
        deleteMany: {},
      },
    },
  });
}

/**
 * Deactivate a service type
 * Admin action: prevents new requests using this service
 */
export async function softDeleteServiceType(serviceTypeId: string) {
  return db.serviceType.update({
    where: { id: serviceTypeId },
    data: {
      isActive: false,
    },
  });
}

/**
 * Deactivate a package
 * Admin action: prevents new subscriptions to this package
 */
export async function softDeletePackage(packageId: string) {
  return db.package.update({
    where: { id: packageId },
    data: {
      isActive: false,
    },
  });
}

/**
 * Soft delete a request
 * Admin/Client action: hides request from listings
 */
export async function softDeleteRequest(requestId: string) {
  return db.request.update({
    where: { id: requestId },
    data: {
      deletedAt: new Date(),
      status: "CANCELLED",
    },
  });
}

/**
 * Restore a soft-deleted user
 * Admin action: re-enables user account
 */
export async function restoreUser(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { deletedAt: null },
  });
}

/**
 * Reactivate a service type
 */
export async function restoreServiceType(serviceTypeId: string) {
  return db.serviceType.update({
    where: { id: serviceTypeId },
    data: {
      deletedAt: null,
      isActive: true,
    },
  });
}

/**
 * Reactivate a package
 */
export async function restorePackage(packageId: string) {
  return db.package.update({
    where: { id: packageId },
    data: {
      deletedAt: null,
      isActive: true,
    },
  });
}

/**
 * Restore a soft-deleted request
 */
export async function restoreRequest(requestId: string) {
  return db.request.update({
    where: { id: requestId },
    data: { deletedAt: null },
  });
}

/**
 * Get all active (non-deleted) users with optional filter
 */
export async function getActiveUsers(filter?: { role?: string }) {
  const where: any = {
    deletedAt: null,
  };
  
  if (filter?.role) {
    where.role = filter.role;
  }
  
  return db.user.findMany({ where });
}

/**
 * Get all active service types
 */
export async function getActiveServiceTypes() {
  return db.serviceType.findMany({
    where: {
      isActive: true,
    },
  });
}

/**
 * Get all active packages
 */
export async function getActivePackages() {
  return db.package.findMany({
    where: {
      isActive: true,
    },
  });
}

/**
 * Get all active (non-deleted) requests with optional filter
 */
export async function getActiveRequests(filter?: { clientId?: string; providerId?: string; status?: string }) {
  const where: any = {
    deletedAt: null,
  };
  
  if (filter?.clientId) {
    where.clientId = filter.clientId;
  }
  
  if (filter?.providerId) {
    where.providerId = filter.providerId;
  }
  
  if (filter?.status) {
    where.status = filter.status;
  }
  
  return db.request.findMany({ where });
}

/**
 * Permanently delete a soft-deleted record (use with caution)
 */
export async function permanentlyDeleteUser(userId: string) {
  return db.user.delete({
    where: { id: userId },
  });
}

export async function permanentlyDeleteRequest(requestId: string) {
  return db.request.delete({
    where: { id: requestId },
  });
}

export async function permanentlyDeleteServiceType(serviceTypeId: string) {
  return db.serviceType.delete({
    where: { id: serviceTypeId },
  });
}

export async function permanentlyDeletePackage(packageId: string) {
  return db.package.delete({
    where: { id: packageId },
  });
}