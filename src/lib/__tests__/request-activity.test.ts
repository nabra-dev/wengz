import { logRequestActivity, REQUEST_ENTITY_TYPE } from "@/lib/request-activity";
import { logActivityAsync } from "@/lib/activity-log";

jest.mock("@/lib/activity-log", () => ({
  logActivityAsync: jest.fn(),
}));

const mockedLog = logActivityAsync as jest.MockedFunction<typeof logActivityAsync>;

describe("logRequestActivity", () => {
  beforeEach(() => {
    mockedLog.mockClear();
  });

  it("writes a Request-scoped activity with actor and reason", () => {
    logRequestActivity({
      action: "request.deliver",
      requestId: "req_1",
      actorId: "user_1",
      actorRole: "PROVIDER",
      message: "Work delivered",
      reason: "Final files attached",
      metadata: { fileCount: 2 },
    });

    expect(mockedLog).toHaveBeenCalledWith({
      action: "request.deliver",
      message: "Work delivered",
      actorId: "user_1",
      actorRole: "PROVIDER",
      entityType: REQUEST_ENTITY_TYPE,
      entityId: "req_1",
      metadata: { fileCount: 2, reason: "Final files attached" },
      level: "info",
    });
  });

  it("omits empty reason from metadata", () => {
    logRequestActivity({
      action: "request.claim",
      requestId: "req_2",
      message: "Claimed",
      reason: "   ",
    });

    expect(mockedLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "req_2",
        metadata: null,
      })
    );
  });
});
