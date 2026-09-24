import {
  formatCompactDuration,
  getDeliveryTimingStatus,
  toDate,
} from "@/lib/request-timing";

describe("request timing helpers", () => {
  it("formats compact durations", () => {
    expect(formatCompactDuration(45 * 60_000)).toBe("45m");
    expect(formatCompactDuration(125 * 60_000)).toBe("2h 5m");
    expect(formatCompactDuration(26 * 60 * 60_000)).toBe("1d 2h");
  });

  it("derives delivery timing status", () => {
    const estimated = new Date("2026-01-02T12:00:00Z");
    expect(
      getDeliveryTimingStatus({
        estimatedDelivery: estimated,
        deliveredAt: new Date("2026-01-02T11:00:00Z"),
      })
    ).toBe("on_time");
    expect(
      getDeliveryTimingStatus({
        estimatedDelivery: estimated,
        deliveredAt: new Date("2026-01-02T13:00:00Z"),
      })
    ).toBe("late");
    expect(
      getDeliveryTimingStatus({
        estimatedDelivery: estimated,
        now: new Date("2026-01-02T11:00:00Z"),
      })
    ).toBe("on_track");
    expect(
      getDeliveryTimingStatus({
        estimatedDelivery: estimated,
        now: new Date("2026-01-02T13:00:00Z"),
      })
    ).toBe("overdue");
    expect(getDeliveryTimingStatus({})).toBe("pending");
  });

  it("parses dates safely", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate("not-a-date")).toBeNull();
    expect(toDate("2026-01-01T00:00:00Z")?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
