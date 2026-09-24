import {
  extractRequestIdFromLink,
  isProviderJobsNotification,
  markRequestsUnread,
  getUnreadRequestIds,
  getUnreadIdsSnapshot,
  markRequestRead,
} from "@/lib/provider-request-unread";

describe("provider request unread helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("extracts request ids from provider links", () => {
    expect(extractRequestIdFromLink("/provider/available/abc123")).toBe("abc123");
    expect(extractRequestIdFromLink("/en/provider/requests/req_9")).toBe("req_9");
    expect(extractRequestIdFromLink("/provider/available")).toBeNull();
  });

  it("detects provider job-related notifications", () => {
    expect(
      isProviderJobsNotification({ type: "general", link: "/provider/available/x" })
    ).toBe(true);
    expect(isProviderJobsNotification({ type: "assignment", link: "/provider/wallet" })).toBe(
      true
    );
    expect(isProviderJobsNotification({ type: "general", link: "/provider/wallet" })).toBe(
      false
    );
  });

  it("batch-marks unread ids with a single set", () => {
    markRequestsUnread("u1", ["a", "b", "a", ""]);
    expect([...getUnreadRequestIds("u1")].sort()).toEqual(["a", "b"]);
    expect(getUnreadIdsSnapshot("u1")).toBe(JSON.stringify(["a", "b"]));

    markRequestRead("u1", "a");
    expect([...getUnreadRequestIds("u1")]).toEqual(["b"]);
  });
});
