import {
  canAccessAdminPath,
  canManageFinance,
  canManagePlatform,
  canManageRequests,
  getRoleChangeBlockReason,
  getStaffHomePath,
  isAssignableRole,
  isStaffRole,
  isSuperAdmin,
  ROLES,
} from "@/lib/roles";

describe("roles access helpers", () => {
  it("identifies staff vs marketplace roles", () => {
    expect(isStaffRole("SUPER_ADMIN")).toBe(true);
    expect(isStaffRole("PROJECT_MANAGER")).toBe(true);
    expect(isStaffRole("FINANCE_MANAGER")).toBe(true);
    expect(isStaffRole("PROVIDER")).toBe(false);
    expect(isStaffRole("CLIENT")).toBe(false);
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
    expect(isSuperAdmin("PROJECT_MANAGER")).toBe(false);
  });

  it("scopes request and finance capabilities", () => {
    expect(canManageRequests("PROJECT_MANAGER")).toBe(true);
    expect(canManageRequests("FINANCE_MANAGER")).toBe(false);
    expect(canManageFinance("FINANCE_MANAGER")).toBe(true);
    expect(canManageFinance("PROJECT_MANAGER")).toBe(false);
    expect(canManagePlatform("SUPER_ADMIN")).toBe(true);
    expect(canManagePlatform("PROJECT_MANAGER")).toBe(false);
  });

  it("maps staff home paths", () => {
    expect(getStaffHomePath("PROJECT_MANAGER")).toBe("/admin/requests");
    expect(getStaffHomePath("FINANCE_MANAGER")).toBe("/admin/finance");
    expect(getStaffHomePath("SUPER_ADMIN")).toBe("/admin");
  });

  it("gates admin paths by role", () => {
    expect(canAccessAdminPath("PROJECT_MANAGER", "admin")).toBe(false);
    expect(canAccessAdminPath("PROJECT_MANAGER", "admin/requests")).toBe(true);
    expect(canAccessAdminPath("PROJECT_MANAGER", "admin/finance")).toBe(false);
    expect(canAccessAdminPath("FINANCE_MANAGER", "admin/finance")).toBe(true);
    expect(canAccessAdminPath("FINANCE_MANAGER", "admin/payments")).toBe(true);
    expect(canAccessAdminPath("FINANCE_MANAGER", "admin/settings")).toBe(true);
    expect(canAccessAdminPath("FINANCE_MANAGER", "admin/users")).toBe(false);
    expect(canAccessAdminPath("SUPER_ADMIN", "admin/users")).toBe(true);
    expect(canAccessAdminPath("CLIENT", "admin/requests")).toBe(false);
  });
});

describe("getRoleChangeBlockReason", () => {
  it("blocks super admin create/change", () => {
    expect(
      getRoleChangeBlockReason({
        currentRole: ROLES.CLIENT,
        newRole: ROLES.SUPER_ADMIN,
        clientRequestCount: 0,
        providerRequestCount: 0,
      })
    ).toMatch(/super admin/i);
    expect(
      getRoleChangeBlockReason({
        currentRole: ROLES.SUPER_ADMIN,
        newRole: ROLES.CLIENT,
        clientRequestCount: 0,
        providerRequestCount: 0,
      })
    ).toMatch(/super admin/i);
  });

  it("blocks client with requests becoming provider", () => {
    expect(
      getRoleChangeBlockReason({
        currentRole: ROLES.CLIENT,
        newRole: ROLES.PROVIDER,
        clientRequestCount: 2,
        providerRequestCount: 0,
      })
    ).toMatch(/clients with existing requests/i);
    expect(
      getRoleChangeBlockReason({
        currentRole: ROLES.CLIENT,
        newRole: ROLES.PROVIDER,
        clientRequestCount: 0,
        providerRequestCount: 0,
      })
    ).toBeNull();
  });

  it("blocks provider with requests becoming client", () => {
    expect(
      getRoleChangeBlockReason({
        currentRole: ROLES.PROVIDER,
        newRole: ROLES.CLIENT,
        clientRequestCount: 0,
        providerRequestCount: 1,
      })
    ).toMatch(/providers with existing requests/i);
  });

  it("allows staff role swaps without request conflicts", () => {
    expect(
      getRoleChangeBlockReason({
        currentRole: ROLES.CLIENT,
        newRole: ROLES.PROJECT_MANAGER,
        clientRequestCount: 5,
        providerRequestCount: 0,
      })
    ).toBeNull();
    expect(
      getRoleChangeBlockReason({
        currentRole: ROLES.PROVIDER,
        newRole: ROLES.FINANCE_MANAGER,
        clientRequestCount: 0,
        providerRequestCount: 3,
      })
    ).toBeNull();
    expect(isAssignableRole(ROLES.SUPER_ADMIN)).toBe(false);
  });
});
