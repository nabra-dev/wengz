import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/roles";
import type { AttributeResponse, ServiceAttribute } from "@/types/service-attributes";
import { collectAttributeMediaUrls } from "@/lib/attribute-validation";

export type RequestFileAccessOptions = {
  /** Restrict to requests this user participates in (or may browse as available). */
  participantUserId?: string;
  /**
   * When true, also grant access for unclaimed PENDING requests.
   * Mirrors provider available-job browsing in `request.getById`.
   */
  allowUnclaimedPending?: boolean;
};

/** True when attributeResponses JSON references this private file URL/key. */
export function attributeResponsesContainFile(
  attributeResponses: unknown,
  attributes: unknown,
  key: string,
  url: string
): boolean {
  if (!attributeResponses) return false;

  const mediaUrls = collectAttributeMediaUrls(
    attributes as ServiceAttribute[] | null | undefined,
    attributeResponses as AttributeResponse[] | null | undefined
  );
  if (mediaUrls.some((mediaUrl) => mediaUrl === url || mediaUrl.includes(key))) {
    return true;
  }

  // Fallback when service attribute schema changed / is missing — still honor stored URLs.
  try {
    const text = JSON.stringify(attributeResponses);
    return text.includes(url) || text.includes(key);
  } catch {
    return false;
  }
}

function buildAccessOr(options?: RequestFileAccessOptions): Prisma.RequestWhereInput[] | undefined {
  if (!options?.participantUserId) return undefined;

  const clauses: Prisma.RequestWhereInput[] = [
    { clientId: options.participantUserId },
    { providerId: options.participantUserId },
    { watchers: { some: { userId: options.participantUserId } } },
  ];

  if (options.allowUnclaimedPending) {
    // Providers preview brief/attachments before claiming (available jobs).
    clauses.push({ status: "PENDING", providerId: null });
  }

  return clauses;
}

/**
 * Whether a request record the viewer may see references this file
 * (attachments, comment files, or attribute file/voice answers).
 */
export async function existsRequestFile(
  key: string,
  url: string,
  options?: RequestFileAccessOptions
): Promise<boolean> {
  const accessOr = buildAccessOr(options);

  const viaArrays = await db.request.findFirst({
    where: {
      deletedAt: null,
      ...(accessOr ? { OR: accessOr } : {}),
      AND: [
        {
          OR: [
            { attachments: { has: url } },
            { attachments: { has: key } },
            { comments: { some: { files: { has: url } } } },
            { comments: { some: { files: { has: key } } } },
          ],
        },
      ],
    },
    select: { id: true },
  });
  if (viaArrays) return true;

  // Attribute media lives in JSON. Narrow by uploader id from the storage key
  // (`uploads/<userId>/...`) — clients may only attach their own uploads.
  const uploaderId = key.startsWith("uploads/") ? key.split("/")[1] : null;
  if (!uploaderId) return false;

  const candidates = await db.request.findMany({
    where: {
      deletedAt: null,
      clientId: uploaderId,
      attributeResponses: { not: Prisma.DbNull },
      ...(accessOr ? { OR: accessOr } : {}),
    },
    select: {
      attributeResponses: true,
      serviceType: { select: { attributes: true } },
    },
  });

  return candidates.some((request) =>
    attributeResponsesContainFile(
      request.attributeResponses,
      request.serviceType.attributes,
      key,
      url
    )
  );
}

/** Whether this role should get the available-job (unclaimed PENDING) file grant. */
export function shouldAllowUnclaimedPendingFiles(role: string): boolean {
  return role === ROLES.PROVIDER;
}
