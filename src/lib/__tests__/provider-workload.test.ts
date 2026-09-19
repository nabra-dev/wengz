import {
  canClaimAdditionalRequest,
  canStartNewInProgressWork,
  type ProviderWorkload,
} from "@/lib/provider-workload";

describe("provider-workload", () => {
  const empty: ProviderWorkload = {
    inProgressCount: 0,
    revisionCount: 0,
    totalActive: 0,
  };

  it("allows starting when idle", () => {
    expect(canStartNewInProgressWork(empty)).toBe(true);
    expect(canClaimAdditionalRequest(empty)).toBe(true);
  });

  it("blocks starting when already in progress", () => {
    const workload: ProviderWorkload = {
      inProgressCount: 1,
      revisionCount: 0,
      totalActive: 1,
    };
    expect(canStartNewInProgressWork(workload)).toBe(false);
    expect(canClaimAdditionalRequest(workload)).toBe(false);
  });

  it("allows one additional in-progress when only revisions are open", () => {
    const workload: ProviderWorkload = {
      inProgressCount: 0,
      revisionCount: 1,
      totalActive: 1,
    };
    expect(canStartNewInProgressWork(workload)).toBe(true);
    expect(canClaimAdditionalRequest(workload)).toBe(true);
  });

  it("blocks when revision and in-progress are both open", () => {
    const workload: ProviderWorkload = {
      inProgressCount: 1,
      revisionCount: 1,
      totalActive: 2,
    };
    expect(canStartNewInProgressWork(workload)).toBe(false);
    expect(canClaimAdditionalRequest(workload)).toBe(false);
  });
});
