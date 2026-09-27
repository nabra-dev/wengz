/**
 * @jest-environment node
 */
import { TRPCError } from "@trpc/server";

const findUnique = jest.fn();
const deleteCached = jest.fn();
const setCached = jest.fn();

jest.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

jest.mock("@/lib/cache", () => ({
  setCached: (...args: unknown[]) => setCached(...args),
  deleteCached: (...args: unknown[]) => deleteCached(...args),
  cacheKeys: { USER: (id: string) => `user:${id}` },
}));

describe("revalidateSessionUser approval gate", () => {
  beforeEach(() => {
    jest.resetModules();
    findUnique.mockReset();
    deleteCached.mockReset();
    setCached.mockReset();
  });

  it("rejects PENDING users", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      role: "CLIENT",
      deletedAt: null,
      approvalStatus: "PENDING",
    });

    const { revalidateSessionUser } = await import("@/lib/session-user-cache");

    await expect(revalidateSessionUser("u1")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    } satisfies Partial<TRPCError>);
  });

  it("allows APPROVED users", async () => {
    findUnique.mockResolvedValue({
      id: "u2",
      role: "CLIENT",
      deletedAt: null,
      approvalStatus: "APPROVED",
    });

    const { revalidateSessionUser, invalidateSessionUserCache } =
      await import("@/lib/session-user-cache");
    await invalidateSessionUserCache("u2");

    const snap = await revalidateSessionUser("u2");
    expect(snap).toEqual({
      id: "u2",
      role: "CLIENT",
      deletedAt: null,
      approvalStatus: "APPROVED",
    });
  });
});
