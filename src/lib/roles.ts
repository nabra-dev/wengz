/**
 * Application roles and staff access helpers.
 * Super admin retains full platform access; limited staff roles are scoped.
 */

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  PROJECT_MANAGER: "PROJECT_MANAGER",
  FINANCE_MANAGER: "FINANCE_MANAGER",
  PROVIDER: "PROVIDER",
  CLIENT: "CLIENT",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export type StaffRole =
  | typeof ROLES.SUPER_ADMIN
  | typeof ROLES.PROJECT_MANAGER
  | typeof ROLES.FINANCE_MANAGER;

export const STAFF_ROLES: readonly StaffRole[] = [
  ROLES.SUPER_ADMIN,
  ROLES.PROJECT_MANAGER,
  ROLES.FINANCE_MANAGER,
] as const;

/**
 * Roles that can be created/changed via admin user management.
 * SUPER_ADMIN is intentionally excluded — no CRUD on the sole super admin.
 */
export const ASSIGNABLE_ROLES = [
  ROLES.CLIENT,
  ROLES.PROVIDER,
  ROLES.PROJECT_MANAGER,
  ROLES.FINANCE_MANAGER,
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** All roles including super admin (filters / display only). */
export const ALL_ROLES = [...ASSIGNABLE_ROLES, ROLES.SUPER_ADMIN] as const;

export function isAssignableRole(role: string | null | undefined): role is AssignableRole {
  return (
    role === ROLES.CLIENT ||
    role === ROLES.PROVIDER ||
    role === ROLES.PROJECT_MANAGER ||
    role === ROLES.FINANCE_MANAGER
  );
}

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return (
    role === ROLES.SUPER_ADMIN ||
    role === ROLES.PROJECT_MANAGER ||
    role === ROLES.FINANCE_MANAGER
  );
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === ROLES.SUPER_ADMIN;
}

/**
 * Why a role change is blocked, or null if allowed.
 * Used by admin API + UI hints.
 */
export function getRoleChangeBlockReason(params: {
  currentRole: string;
  newRole: string;
  clientRequestCount: number;
  providerRequestCount: number;
}): string | null {
  const { currentRole, newRole, clientRequestCount, providerRequestCount } = params;

  if (currentRole === newRole) return null;

  if (isSuperAdmin(currentRole) || isSuperAdmin(newRole)) {
    return "Super admin accounts cannot be created or changed through user management";
  }

  if (!isAssignableRole(newRole)) {
    return "Invalid role";
  }

  if (currentRole === ROLES.CLIENT && newRole === ROLES.PROVIDER && clientRequestCount > 0) {
    return "Clients with existing requests cannot be changed to providers";
  }

  if (currentRole === ROLES.PROVIDER && newRole === ROLES.CLIENT && providerRequestCount > 0) {
    return "Providers with existing requests cannot be changed to clients";
  }

  return null;
}

/** Client–provider request oversight (assign, view, moderate threads). */
export function canManageRequests(role: string | null | undefined): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.PROJECT_MANAGER;
}

/** Payments, wallets, withdrawals, finance settings. */
export function canManageFinance(role: string | null | undefined): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.FINANCE_MANAGER;
}

/** Users, catalog, packages, activity, maintenance, full settings. */
export function canManagePlatform(role: string | null | undefined): boolean {
  return role === ROLES.SUPER_ADMIN;
}

export function getStaffHomePath(role: string | null | undefined): string {
  if (role === ROLES.PROJECT_MANAGER) return "/admin/requests";
  if (role === ROLES.FINANCE_MANAGER) return "/admin/finance";
  if (role === ROLES.SUPER_ADMIN) return "/admin";
  if (role === ROLES.PROVIDER) return "/provider";
  if (role === ROLES.CLIENT) return "/client";
  return "/";
}

/**
 * Path without locale, e.g. `admin/requests` or `admin/finance`.
 * Used by edge middleware and client layouts.
 */
export function canAccessAdminPath(
  role: string | null | undefined,
  pathWithoutLocale: string
): boolean {
  if (!isStaffRole(role)) return false;

  const path = pathWithoutLocale.replace(/^\/+/, "").replace(/\/+$/, "") || "admin";
  const segments = path.split("/");
  if (segments[0] !== "admin") return false;

  const section = segments[1] ?? "";

  // Shared staff surfaces
  if (section === "profile" || section === "notifications") {
    return true;
  }

  // Full dashboard is super-admin only; limited staff land on their home section
  if (!section) {
    return canManagePlatform(role);
  }

  if (section === "requests") {
    return canManageRequests(role);
  }

  if (section === "finance" || section === "payments" || section === "subscriptions") {
    return canManageFinance(role);
  }

  // Finance settings live on the settings page; finance managers may open it
  // (UI shows only finance/payment sections). Platform-only otherwise.
  if (section === "settings") {
    return canManagePlatform(role) || canManageFinance(role);
  }

  // users, packages, services, activity, and anything else → super admin only
  return canManagePlatform(role);
}
