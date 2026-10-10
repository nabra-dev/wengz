import { z } from "zod";
import { router, protectedProcedure, clientProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { handleRevisionRequest, getRevisionInfo } from "@/lib/revision-logic";
import { calculateAttributeCredits } from "@/lib/attribute-validation";
import { assertAllowedUploadUrls } from "@/lib/upload-url";
import {
  getProviderWorkload,
  canStartNewInProgressWork,
  PROVIDER_AT_CAPACITY_MESSAGE,
} from "@/lib/provider-workload";
import {
  getLocalizedRequestStatusLabel,
  notifyClientRequestAccepted,
  notifyNewMessage,
  notifyProviderRatingSubmitted,
  notifyStatusChange,
} from "@/lib/notifications";
import { getTranslation } from "@/lib/notifications/i18n-helper";
import { canManageRequests } from "@/lib/roles";
import { logRequestActivity } from "@/lib/request-activity";
import { createServiceRequest } from "@/lib/create-request";
import { approveDeliveredRequest } from "@/lib/approve-delivered-request";
import { enforceNoContactLeak } from "@/lib/contact-leak-enforce";
import { providerCanViewClientIdentity } from "@/lib/client-identity";
import type { ServiceAttribute, AttributeResponse } from "@/types/service-attributes";

/**
 * Validates request access based on user role
 */
function validateRequestAccess(userId: string, role: string, request: any) {
  // Staff may open soft-deleted requests to restore / audit them.
  if (canManageRequests(role)) {
    return;
  }

  if (request.deletedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Request not found",
    });
  }

  if (role === "CLIENT" && request.clientId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have access to this request",
    });
  }

  if (role === "PROVIDER" && request.providerId !== userId && request.status !== "PENDING") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have access to this request",
    });
  }

  if (role !== "CLIENT" && role !== "PROVIDER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have access to this request",
    });
  }
}

/**
 * Calculates attribute credits with fallback for old requests
 */
function getAttributeCredits(request: any): number {
  let attributeCredits = request.attributeCredits ?? 0;

  if (attributeCredits === 0) {
    const rawAttributeResponses = request.attributeResponses;
    const serviceAttributes = request.serviceType?.attributes;

    if (serviceAttributes && rawAttributeResponses) {
      const calculated = calculateAttributeCredits(
        serviceAttributes as ServiceAttribute[],
        rawAttributeResponses as AttributeResponse[]
      );
      if (calculated > 0) {
        attributeCredits = calculated;
      }
    }
  }

  return attributeCredits;
}

export const requestRouter = router({
  // Create a new request (client only)
  create: clientProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/request",
        tags: ["request"],
        summary: "Create a new service request",
      },
    })
    .input(
      z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required"),
        serviceTypeId: z.string(),
        formData: z.record(z.any()).optional(),
        attributeResponses: z.any().optional(), // Client's answers to service Q&A: [{question: string, answer: string}]
        attachments: z.array(z.string()).optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        request: z.any(),
        creditsRemaining: z.number(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      return createServiceRequest({
        db: ctx.db,
        clientId: userId,
        actorId: userId,
        actorRole: ctx.session.user.role,
        locale: ctx.locale,
        title: input.title,
        description: input.description,
        serviceTypeId: input.serviceTypeId,
        formData: input.formData,
        attributeResponses: input.attributeResponses,
        attachments: input.attachments,
        uploaderUserId: userId,
        createdByStaff: false,
      });
    }),

  // Get all requests for current user (role-based)
  getAll: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/request/list",
        tags: ["request"],
        summary: "List requests for current user",
      },
    })
    .input(
      z
        .object({
          status: z
            .enum([
              "PENDING",
              "IN_PROGRESS",
              "DELIVERED",
              "REVISION_REQUESTED",
              "COMPLETED",
              "CANCELLED",
            ])
            .optional(),
          limit: z.number().min(1).max(100).default(20),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .output(
      z.object({
        requests: z.array(z.any()),
        nextCursor: z.string().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      let where: any = {};
      let providerSupportedServiceIds: string[] | null = null;

      if (role === "CLIENT") {
        where.clientId = userId;
      } else if (role === "PROVIDER") {
        // Providers see their own requests + pending requests matching their
        // supported services only (prevents browsing unrelated client work).
        const providerProfile = await ctx.db.providerProfile.findUnique({
          where: { userId },
          include: { supportedServices: { select: { id: true } } },
        });
        providerSupportedServiceIds =
          providerProfile?.supportedServices.map((s: { id: string }) => s.id) || [];

        where = {
          OR: [
            { providerId: userId },
            {
              AND: [
                { status: "PENDING" },
                { providerId: null },
                { serviceTypeId: { in: providerSupportedServiceIds } },
              ],
            },
          ],
        };
      } else if (!canManageRequests(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to requests",
        });
      }
      // Request managers / super admins see all requests

      if (input?.status) {
        where.status = input.status;
      }

      const requests = await ctx.db.request.findMany({
        where: { ...where, deletedAt: null },
        include: {
          client: {
            select: { id: true, name: true, email: true, image: true },
          },
          provider: {
            select: { id: true, name: true, email: true, image: true },
          },
          serviceType: true,
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit || 20,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        skip: input?.cursor ? 1 : 0,
      });

      // Providers browsing unassigned pending requests must not see client PII.
      const sanitized =
        role === "PROVIDER"
          ? requests.map((r) =>
              r.providerId === userId ? r : { ...r, client: { ...r.client, email: null } }
            )
          : requests;

      // Use stored credit cost (no need to recalculate, preserves historical costs)
      return {
        requests: sanitized,
        nextCursor: requests.length === (input?.limit || 20) ? (requests.at(-1)?.id ?? null) : null,
      };
    }),

  // Get single request by ID
  getById: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/request/{id}",
        tags: ["request"],
        summary: "Get request by ID",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.any())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      const request = await ctx.db.request.findUnique({
        where: { id: input.id },
        include: {
          client: {
            select: { id: true, name: true, email: true, image: true },
          },
          provider: {
            select: { id: true, name: true, email: true, image: true },
          },
          serviceType: {
            select: {
              id: true,
              name: true,
              nameI18n: true,
              descriptionI18n: true,
              icon: true,
              creditCost: true,
              attributes: true,
              maxFreeRevisions: true,
              paidRevisionCost: true,
              maxDeliveryMinutes: true,
              deletedAt: true,
            },
          },
          comments: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true, role: true },
              },
            },
            // Latest N comments only — prevents unbounded chat payloads on poll.
            orderBy: { createdAt: "desc" },
            take: 100,
          },
          rating: true,
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      // Access control
      validateRequestAccess(userId, role, request);

      const commentsChronological = [...request.comments].reverse();

      // Providers viewing an unassigned pending request must not see client PII.
      const isProviderBrowsing = role === "PROVIDER" && request.providerId !== userId;
      const visibleRequest = isProviderBrowsing
        ? {
            ...request,
            client: { ...request.client, email: null },
            comments: [],
          }
        : {
            ...request,
            comments: commentsChronological,
          };

      // Get revision info if client
      let revisionInfo = null;
      if (role === "CLIENT" || canManageRequests(role)) {
        revisionInfo = await getRevisionInfo(input.id, request.clientId);
      }

      // Calculate attribute credits with backward compatibility
      const attributeCredits = getAttributeCredits(request);

      return {
        ...visibleRequest,
        attributeCredits,
        revisionInfo,
        commentsTruncated: !isProviderBrowsing && request.comments.length >= 100,
      } as any;
    }),

  /**
   * Approved delivery history for a client (URL refs only).
   * Visible to PM/SA and providers with an assigned or available job for that client.
   */
  getClientIdentity: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(24),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      if (canManageRequests(role)) {
        // allowed
      } else if (role === "PROVIDER") {
        const allowed = await providerCanViewClientIdentity(ctx.db, userId, input.clientId);
        if (!allowed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this client identity",
          });
        }
      } else {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this client identity",
        });
      }

      const items = await ctx.db.clientIdentityAsset.findMany({
        where: { clientId: input.clientId },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          fileUrl: true,
          createdAt: true,
          serviceType: {
            select: {
              id: true,
              name: true,
              nameI18n: true,
              icon: true,
            },
          },
          sourceRequest: {
            select: {
              id: true,
              title: true,
              completedAt: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  // Provider accepts a request
  accept: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        estimatedDays: z.number().min(1).max(90).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const role = ctx.session.user.role;

      if (role !== "PROVIDER" && !canManageRequests(role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only creators can accept requests",
        });
      }

      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      if (!request || request.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      // Enforce skill match for providers (admins may assign freely).
      if (role === "PROVIDER") {
        const providerProfile = await ctx.db.providerProfile.findUnique({
          where: { userId },
          include: { supportedServices: { select: { id: true } } },
        });
        const supportedServiceIds =
          providerProfile?.supportedServices.map((s: { id: string }) => s.id) || [];

        if (!supportedServiceIds.includes(request.serviceTypeId)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This request is not in your supported services",
          });
        }

        const workload = await getProviderWorkload(userId);
        if (!canStartNewInProgressWork(workload)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: PROVIDER_AT_CAPACITY_MESSAGE,
          });
        }
      }

      const estimatedDelivery = input.estimatedDays
        ? new Date(Date.now() + input.estimatedDays * 24 * 60 * 60 * 1000)
        : null;

      // Atomic accept: only succeeds while the request is still unassigned.
      const accepted = await ctx.db.request.updateMany({
        where: { id: input.requestId, providerId: null, status: "PENDING" },
        data: {
          providerId: userId,
          status: "IN_PROGRESS",
          estimatedDelivery,
        },
      });

      if (accepted.count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This request has already been accepted",
        });
      }

      const updatedRequest = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      // Create system comment
      const deliveryDate = estimatedDelivery ? estimatedDelivery.toLocaleDateString() : null;
      const requestAcceptedComment = deliveryDate
        ? await getTranslation(
            ctx.locale,
            "requests.messages.systemMessages.requestAcceptedWithDelivery",
            {
              deliveryDate,
            }
          )
        : await getTranslation(ctx.locale, "requests.messages.systemMessages.requestAccepted");
      await ctx.db.requestComment.create({
        data: {
          requestId: input.requestId,
          userId,
          content: requestAcceptedComment,
          type: "SYSTEM",
        },
      });

      await notifyClientRequestAccepted({
        requestId: request.id,
        clientId: request.clientId,
        requestTitle: request.title,
        locale: ctx.locale,
      });

      logRequestActivity({
        action: "request.accept",
        requestId: input.requestId,
        actorId: userId,
        actorRole: role,
        message: `Request accepted: ${request.title}`,
        metadata: {
          estimatedDays: input.estimatedDays ?? null,
          previousStatus: request.status,
          newStatus: "IN_PROGRESS",
        },
      });

      return {
        success: true,
        request: updatedRequest,
      };
    }),

  // Update request status (provider)
  updateStatus: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        status: z.enum(["IN_PROGRESS", "DELIVERED"]),
        message: z.string().optional(),
        files: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      if (!request || request.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      if (request.providerId !== userId && !canManageRequests(ctx.session.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this request",
        });
      }

      if (
        input.status === "IN_PROGRESS" &&
        request.status !== "IN_PROGRESS" &&
        !canManageRequests(ctx.session.user.role) &&
        request.providerId === userId
      ) {
        const workload = await getProviderWorkload(userId);
        if (!canStartNewInProgressWork(workload)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: PROVIDER_AT_CAPACITY_MESSAGE,
          });
        }
      }

      try {
        assertAllowedUploadUrls(input.files, userId);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid file URL. Upload files through the app first.",
        });
      }

      if (input.message) {
        await enforceNoContactLeak(input.message, "strict", {
          locale: ctx.locale,
          actorId: userId,
          actorRole: ctx.session.user.role,
          entityId: input.requestId,
          field: "status_message",
        });
      }

      const updatedRequest = await ctx.db.request.update({
        where: { id: input.requestId },
        data:
          input.status === "DELIVERED"
            ? {
                status: "DELIVERED",
                deliveredAt: new Date(),
                approvalReminderSentAt: null,
                needsManualApproval: false,
              }
            : { status: input.status },
      });

      // Create comment
      const commentType = input.status === "DELIVERED" ? "DELIVERABLE" : "SYSTEM";
      let commentContent = input.message;
      if (!commentContent) {
        const statusLabel = await getLocalizedRequestStatusLabel(ctx.locale, input.status);
        commentContent = await getTranslation(
          ctx.locale,
          "requests.messages.systemMessages.statusUpdated",
          {
            status: statusLabel,
          }
        );
      }
      await ctx.db.requestComment.create({
        data: {
          requestId: input.requestId,
          userId,
          content: commentContent,
          type: commentType,
          files: input.files || [],
        },
      });

      await notifyStatusChange({
        requestId: input.requestId,
        userId: request.clientId,
        oldStatus: request.status,
        newStatus: input.status,
        locale: ctx.locale,
      });

      logRequestActivity({
        action: input.status === "DELIVERED" ? "request.deliver" : "request.status",
        requestId: input.requestId,
        actorId: userId,
        actorRole: ctx.session.user.role,
        message: `Request status → ${input.status}: ${request.title}`,
        reason: input.message,
        metadata: {
          previousStatus: request.status,
          newStatus: input.status,
          fileCount: input.files?.length ?? 0,
        },
      });

      return {
        success: true,
        request: updatedRequest,
      };
    }),

  // Request revision (client)
  requestRevision: clientProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/request/revision",
        tags: ["request", "mobile"],
        summary: "Request a revision (client)",
        protect: true,
      },
    })
    .input(
      z.object({
        requestId: z.string(),
        feedback: z.string().min(1, "Feedback is required"),
      })
    )
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Scan feedback before any status/credit mutation so a leak cannot leave a revision applied.
      await enforceNoContactLeak(input.feedback, "strict", {
        locale: ctx.locale,
        actorId: userId,
        actorRole: ctx.session.user.role,
        entityId: input.requestId,
        field: "revision_feedback",
      });

      const result = await handleRevisionRequest(input.requestId, userId, ctx.locale);

      if (!result.allowed) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: result.message,
        });
      }

      // Add the client's feedback as a comment
      await ctx.db.requestComment.create({
        data: {
          requestId: input.requestId,
          userId,
          content: input.feedback,
          type: "MESSAGE",
        },
      });

      logRequestActivity({
        action: "request.revision",
        requestId: input.requestId,
        actorId: userId,
        actorRole: ctx.session.user.role,
        message: result.isFree
          ? `Free revision requested`
          : `Paid revision requested (${result.creditCost} credits)`,
        reason: input.feedback,
        metadata: {
          isFree: result.isFree,
          creditCost: result.creditCost,
          newRevisionCount: result.newRevisionCount,
        },
      });

      return result;
    }),

  // Approve request (client)
  approve: clientProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/request/approve",
        tags: ["request", "mobile"],
        summary: "Approve delivered request (client)",
        protect: true,
      },
    })
    .input(z.object({ requestId: z.string() }))
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      return approveDeliveredRequest({
        db: ctx.db,
        requestId: input.requestId,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
      });
    }),

  // Add comment to request
  addComment: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/request/comment",
        tags: ["request", "mobile"],
        summary: "Add a message/comment on a request",
        protect: true,
      },
    })
    .input(
      z.object({
        requestId: z.string(),
        content: z.string().min(1),
        files: z.array(z.string()).optional(),
      })
    )
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      if (!request || request.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      if (!request.providerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Messaging is available after a creator claims this request",
        });
      }

      // Check access
      const isClient = request.clientId === userId;
      const isProvider = request.providerId === userId;
      const isAdmin = canManageRequests(ctx.session.user.role);

      if (!isClient && !isProvider && !isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this request",
        });
      }

      try {
        assertAllowedUploadUrls(input.files, userId);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid file URL. Upload files through the app first.",
        });
      }

      await enforceNoContactLeak(input.content, "strict", {
        locale: ctx.locale,
        actorId: userId,
        actorRole: ctx.session.user.role,
        entityId: input.requestId,
        field: "message",
      });

      const comment = await ctx.db.requestComment.create({
        data: {
          requestId: input.requestId,
          userId,
          content: input.content,
          type: "MESSAGE",
          files: input.files || [],
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true, role: true },
          },
        },
      });

      // Determine recipients for notifications
      const senderName = comment.user.name || comment.user.email || "Someone";
      const messagePreview = input.content.slice(0, 100);
      if (isClient) {
        await notifyNewMessage({
          requestId: input.requestId,
          senderName,
          senderRole: "CLIENT",
          recipientId: request.providerId,
          messagePreview,
          locale: ctx.locale,
        });
      } else if (isProvider) {
        // Mask provider identity for client-facing notifications
        const brandProviderName = await getTranslation(
          ctx.locale,
          "requests.sidebar.brandProviderName"
        );
        await notifyNewMessage({
          requestId: input.requestId,
          senderName: brandProviderName,
          recipientId: request.clientId,
          messagePreview,
          locale: ctx.locale,
        });
      } else {
        // Staff message — notify both client and assigned creator
        await notifyNewMessage({
          requestId: input.requestId,
          senderName,
          recipientId: request.clientId,
          messagePreview,
          locale: ctx.locale,
        });
        if (request.providerId && request.providerId !== userId) {
          await notifyNewMessage({
            requestId: input.requestId,
            senderName,
            recipientId: request.providerId,
            messagePreview,
            locale: ctx.locale,
          });
        }
      }

      logRequestActivity({
        action: "request.message",
        requestId: input.requestId,
        actorId: userId,
        actorRole: ctx.session.user.role,
        message: `Message posted on request: ${request.title}`,
        metadata: {
          commentId: comment.id,
          fileCount: input.files?.length ?? 0,
          contentLength: input.content.trim().length,
        },
      });

      return comment;
    }),

  // Submit rating (client)
  rate: clientProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/request/rate",
        tags: ["request", "mobile"],
        summary: "Rate completed request (client)",
        protect: true,
      },
    })
    .input(
      z.object({
        requestId: z.string(),
        rating: z.number().min(1).max(5),
        reviewText: z.string().optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        rating: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      if (!request || request.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      if (request.clientId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't own this request",
        });
      }

      if (request.status !== "COMPLETED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Request must be completed before rating",
        });
      }

      if (!request.providerId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No creator assigned to this request",
        });
      }

      // Check if already rated
      const existingRating = await ctx.db.rating.findUnique({
        where: { requestId: input.requestId },
      });

      if (existingRating) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This request has already been rated",
        });
      }

      if (input.reviewText?.trim()) {
        await enforceNoContactLeak(input.reviewText, "strict", {
          locale: ctx.locale,
          actorId: userId,
          actorRole: ctx.session.user.role,
          entityId: input.requestId,
          field: "rating_review",
        });
      }

      const rating = await ctx.db.rating.create({
        data: {
          requestId: input.requestId,
          clientId: userId,
          providerId: request.providerId,
          rating: input.rating,
          reviewText: input.reviewText,
        },
      });

      await notifyProviderRatingSubmitted({
        providerId: request.providerId,
        requestId: request.id,
        requestTitle: request.title,
        rating: input.rating,
        locale: ctx.locale,
      });

      logRequestActivity({
        action: "request.rate",
        requestId: input.requestId,
        actorId: userId,
        actorRole: ctx.session.user.role,
        message: `Request rated ${input.rating}/5: ${request.title}`,
        reason: input.reviewText,
        metadata: {
          rating: input.rating,
          providerId: request.providerId,
        },
      });

      return {
        success: true,
        rating,
      };
    }),

  // Get service types
  getServiceTypes: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        // Must not be `/request/{something}` — OpenAPI matches `/request/{id}` first.
        path: "/services",
        tags: ["request", "mobile"],
        summary: "List service types available to the current client",
        protect: true,
      },
    })
    .input(z.void())
    .output(z.array(z.any()))
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const { getOrSetCached, cacheKeys, cacheTTL } = await import("@/lib/cache");

      // Get user's active subscription with package services
      const activeSubscription = (await ctx.db.clientSubscription.findFirst({
        where: {
          userId: userId,
          isActive: true,
          endDate: { gte: new Date() },
        },
        include: {
          package: {
            select: {
              id: true,
              supportAllServices: true,
              services: {
                select: {
                  serviceType: { select: { id: true } },
                },
              },
            },
          },
        },
      })) as any;

      // If no active subscription, return empty array
      if (!activeSubscription) {
        return [];
      }

      const allServices = await getOrSetCached(
        cacheKeys.SERVICE_TYPES,
        () =>
          ctx.db.serviceType.findMany({
            where: { isActive: true, deletedAt: null },
            select: {
              id: true,
              name: true,
              nameI18n: true,
              description: true,
              descriptionI18n: true,
              icon: true,
              attributes: true,
              creditCost: true,
              isActive: true,
              sortOrder: true,
            },
            orderBy: { sortOrder: "asc" },
          }),
        cacheTTL.SERVICE_TYPES
      );

      const packageServices = await ctx.db.packageService.findMany({
        where: {
          package: { isActive: true, deletedAt: null },
        },
        select: {
          serviceId: true,
          package: {
            select: { id: true, name: true, nameI18n: true },
          },
        },
      });

      const servicePackageMap = new Map<
        string,
        { id: string; name: string; nameI18n: unknown }[]
      >();
      packageServices.forEach((ps) => {
        if (!servicePackageMap.has(ps.serviceId)) {
          servicePackageMap.set(ps.serviceId, []);
        }
        servicePackageMap.get(ps.serviceId)!.push(ps.package);
      });

      const supportAllServices = activeSubscription.package.supportAllServices;
      const allowedServiceIds = supportAllServices
        ? null
        : new Set(
            activeSubscription.package.services.map(
              (ps: { serviceType: { id: string } }) => ps.serviceType.id
            )
          );

      return allServices.map((service) => {
        const isSupported = supportAllServices || allowedServiceIds?.has(service.id) || false;
        const supportingPackages = servicePackageMap.get(service.id) || [];

        return {
          ...service,
          isSupported,
          supportingPackages,
        };
      });
    }),
});
