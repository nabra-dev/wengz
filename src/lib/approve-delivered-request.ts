import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { settleCompletedRequest } from "@/lib/provider-wallet";
import { notifyStatusChange } from "@/lib/notifications";
import { getTranslation } from "@/lib/notifications/i18n-helper";
import { getPreferredLocaleForUser } from "@/lib/user-locale";
import { logRequestActivity } from "@/lib/request-activity";
import { indexClientIdentityFromRequest } from "@/lib/client-identity";

type Db = PrismaClient;

/**
 * Complete a DELIVERED request (client self-approve or staff on-behalf).
 * Settles provider wallet, clears needsManualApproval, notifies provider (+ client when on-behalf).
 */
export async function approveDeliveredRequest(params: {
  db: Db;
  requestId: string;
  actorId: string;
  actorRole: string;
  /** When true, actor need not be the client (PM / super admin). */
  onBehalfOfClient?: boolean;
}) {
  const { db, requestId, actorId, actorRole, onBehalfOfClient = false } = params;

  const request = await db.request.findUnique({
    where: { id: requestId },
  });

  if (!request || request.deletedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Request not found",
    });
  }

  if (!onBehalfOfClient && request.clientId !== actorId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't own this request",
    });
  }

  if (request.status !== "DELIVERED") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Request must be in DELIVERED status to approve",
    });
  }

  const clientLocale = await getPreferredLocaleForUser(request.clientId);
  const systemMessageKey = onBehalfOfClient
    ? "requests.messages.systemMessages.requestApprovedByStaff"
    : "requests.messages.systemMessages.requestApprovedCompleted";
  const approvedComment = await getTranslation(clientLocale, systemMessageKey);

  const updatedRequest = await db.$transaction(async (tx) => {
    const cas = await tx.request.updateMany({
      where: {
        id: requestId,
        status: "DELIVERED",
        deletedAt: null,
        ...(onBehalfOfClient ? {} : { clientId: actorId }),
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        needsManualApproval: false,
      },
    });

    if (cas.count === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Request must be in DELIVERED status to approve",
      });
    }

    if (request.providerId) {
      await settleCompletedRequest(tx, requestId);
    }

    await tx.requestComment.create({
      data: {
        requestId,
        userId: actorId,
        content: approvedComment,
        type: "SYSTEM",
      },
    });

    await indexClientIdentityFromRequest(tx, {
      clientId: request.clientId,
      requestId,
      serviceTypeId: request.serviceTypeId,
    });

    return tx.request.findUnique({ where: { id: requestId } });
  });

  if (request.providerId) {
    await notifyStatusChange({
      requestId,
      userId: request.providerId,
      oldStatus: "DELIVERED",
      newStatus: "COMPLETED",
    });
  }

  if (onBehalfOfClient) {
    await notifyStatusChange({
      requestId,
      userId: request.clientId,
      oldStatus: "DELIVERED",
      newStatus: "COMPLETED",
    });
  }

  logRequestActivity({
    action: onBehalfOfClient ? "request.approve_on_behalf" : "request.approve",
    requestId,
    actorId,
    actorRole,
    message: onBehalfOfClient
      ? `Request approved on behalf of client: ${request.title}`
      : `Request approved and completed: ${request.title}`,
    metadata: {
      previousStatus: "DELIVERED",
      newStatus: "COMPLETED",
      providerId: request.providerId,
      clientId: request.clientId,
      onBehalfOfClient,
    },
  });

  return {
    success: true as const,
    request: updatedRequest,
  };
}
