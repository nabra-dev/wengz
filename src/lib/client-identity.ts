import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Index final approved delivery files for a client (URL refs only).
 * Uses the latest DELIVERABLE comment on the request.
 */
export async function indexClientIdentityFromRequest(
  db: Db,
  params: {
    clientId: string;
    requestId: string;
    serviceTypeId: string;
  }
): Promise<number> {
  const { clientId, requestId, serviceTypeId } = params;

  const latestDeliverable = await db.requestComment.findFirst({
    where: {
      requestId,
      type: "DELIVERABLE",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, files: true },
  });

  if (!latestDeliverable?.files?.length) {
    return 0;
  }

  const fileUrls = [...new Set(latestDeliverable.files.filter((url) => Boolean(url?.trim())))];
  if (fileUrls.length === 0) {
    return 0;
  }

  let indexed = 0;
  for (const fileUrl of fileUrls) {
    await db.clientIdentityAsset.upsert({
      where: {
        clientId_fileUrl: { clientId, fileUrl },
      },
      create: {
        clientId,
        sourceRequestId: requestId,
        sourceCommentId: latestDeliverable.id,
        fileUrl,
        serviceTypeId,
      },
      update: {
        sourceRequestId: requestId,
        sourceCommentId: latestDeliverable.id,
        serviceTypeId,
      },
    });
    indexed += 1;
  }

  return indexed;
}

/** Whether a provider may view this client's identity (assigned or available job). */
export async function providerCanViewClientIdentity(
  db: Db,
  providerId: string,
  clientId: string
): Promise<boolean> {
  const eligible = await db.request.findFirst({
    where: {
      clientId,
      deletedAt: null,
      OR: [{ providerId }, { status: "PENDING", providerId: null }],
    },
    select: { id: true },
  });
  return Boolean(eligible);
}
