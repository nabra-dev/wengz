import { buildRequestsExcel, buildUsersExcel } from "@/lib/admin-excel-export";

describe("admin excel export", () => {
  it("builds a localized users workbook", async () => {
    const en = await buildUsersExcel({
      locale: "en",
      users: [
        {
          name: "Omar",
          email: "omar@example.com",
          phone: "+20 100",
          role: "CLIENT",
          approvalStatus: "APPROVED",
          createdAt: new Date("2026-01-02T10:00:00Z"),
          deletedAt: null,
          _count: { clientRequests: 2, providerRequests: 0, clientSubscriptions: 1 },
        },
      ],
    });

    expect(en.fileName).toMatch(/^users-en-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(en.rowCount).toBe(1);
    expect(en.base64.length).toBeGreaterThan(100);
    expect(en.contentType).toContain("spreadsheetml");

    const ar = await buildUsersExcel({
      locale: "ar",
      users: [
        {
          name: "عمر",
          email: "omar@example.com",
          role: "PROVIDER",
          approvalStatus: "PENDING",
          createdAt: new Date("2026-01-02T10:00:00Z"),
        },
      ],
    });
    expect(ar.fileName).toMatch(/^users-ar-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(ar.rowCount).toBe(1);
  });

  it("builds a localized requests workbook", async () => {
    const result = await buildRequestsExcel({
      locale: "ar",
      requests: [
        {
          id: "req_1",
          title: "Logo",
          status: "IN_PROGRESS",
          creditCost: 100,
          needsManualApproval: false,
          createdAt: new Date("2026-01-02T10:00:00Z"),
          updatedAt: new Date("2026-01-03T10:00:00Z"),
          client: { name: "Client", email: "c@example.com" },
          provider: null,
          serviceType: {
            name: "Design",
            nameI18n: { en: "Design", ar: "تصميم" },
          },
        },
      ],
    });

    expect(result.fileName).toMatch(/^requests-ar-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(result.rowCount).toBe(1);
    expect(result.base64.length).toBeGreaterThan(100);
  });
});
