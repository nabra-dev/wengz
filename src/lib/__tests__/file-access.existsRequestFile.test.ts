/**
 * @jest-environment node
 */
import { Prisma } from "@prisma/client";

const findFirst = jest.fn();
const findMany = jest.fn();

jest.mock("@/lib/db", () => ({
  db: {
    request: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

import { existsRequestFile } from "@/lib/file-access";

describe("existsRequestFile", () => {
  const key = "uploads/client1/179-voice.webm";
  const url = `/api/files/${key}`;

  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
  });

  it("allows providers to resolve attribute media on unclaimed PENDING jobs", async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([
      {
        attributeResponses: [{ question: "Brief", answer: url }],
        serviceType: {
          attributes: [{ question: "Brief", type: "voice", required: false }],
        },
      },
    ]);

    const allowed = await existsRequestFile(key, url, {
      participantUserId: "provider1",
      allowUnclaimedPending: true,
    });

    expect(allowed).toBe(true);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { status: "PENDING", providerId: null },
            { providerId: "provider1" },
          ]),
        }),
      })
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: "client1",
          attributeResponses: { not: Prisma.DbNull },
        }),
      })
    );
  });

  it("does not grant unclaimed PENDING access without the flag", async () => {
    findFirst.mockResolvedValue(null);
    findMany.mockResolvedValue([]);

    await existsRequestFile(key, url, {
      participantUserId: "provider1",
      allowUnclaimedPending: false,
    });

    const where = findFirst.mock.calls[0][0].where;
    expect(where.OR).not.toEqual(expect.arrayContaining([{ status: "PENDING", providerId: null }]));
  });

  it("returns true when the file is in attachments for a participant", async () => {
    findFirst.mockResolvedValue({ id: "req1" });

    const allowed = await existsRequestFile(key, url, {
      participantUserId: "client1",
    });

    expect(allowed).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });
});
