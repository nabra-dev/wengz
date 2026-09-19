/**
 * @jest-environment node
 */

// Mock the database
jest.mock("@/lib/db", () => ({
  db: {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      count: jest.fn().mockResolvedValue(10),
    },
    request: {
      count: jest.fn().mockResolvedValue(5),
    },
  },
}));

import { GET } from "../route";

describe("Health Check API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with healthy status", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.database).toBe("connected");
  });

  it("should return timestamp without leaking business stats", async () => {
    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty("timestamp");
    // Liveness only — user/request counts must not be exposed publicly.
    expect(data).not.toHaveProperty("stats");
  });
});
