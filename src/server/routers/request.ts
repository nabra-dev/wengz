import { z } from "zod";
import { router, protectedProcedure, clientProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { checkAndDeductCredits } from "@/lib/credit-logic";
import { handleRevisionRequest, getRevisionInfo } from "@/lib/revision-logic";
import { validateAttributeResponses, calculateAttributeCredits } from "@/lib/attribute-validation";
import { getPriorityCostsForService } from "@/lib/priority-costs";
import { settleCompletedRequest } from "@/lib/provider-wallet";
import { assertAllowedUploadUrls } from "@/lib/upload-url";
import {
  getProviderWorkload,
  canStartNewInProgressWork,
  PROVIDER_AT_CAPACITY_MESSAGE,
} from "@/lib/provider-workload";
import {
  createNotification,
  getLocalizedRequestStatusLabel,
  notifyNewMessage,
  notifyStatusChange,
} from "@/lib/notifications";
import { getTranslation } from "@/lib/notifications/i18n-helper";
import type { ServiceAttribute, AttributeResponse } from "@/types/service-attributes";

/**
 * Validates that the user's subscription package allows access to the requested service
 */
async function validateServiceAccess(
  db: any,
  userId: string,
  serviceTypeId: string,
  serviceName: string
) {
  const activeSubscription = await db.clientSubscription.findFirst({
    where: {
      userId: userId,
      isActive: true,
      endDate: { gte: new Date() },
    },
    include: {
      package: {
        include: {
          services: true,
        },
      },
    },
  });

  if (!activeSubscription) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active subscription found. Please subscribe to a package to create requests.",
    });
  }

  // Check if the selected service is allowed by the user's package
  const hasAllServicesSupport = Boolean(
    (activeSubscription.package as { supportAllServices?: boolean }).supportAllServices
  );
  if (!hasAllServicesSupport) {
    const allowedServiceIds = activeSubscription.package.services.map(
      (s: { serviceId: string }) => s.serviceId
    );
    if (!allowedServiceIds.includes(serviceTypeId)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Your ${activeSubscription.package.name} package does not include ${serviceName} service. Please upgrade your subscription to access this service.`,
      });
    }
  }
}

/**
 * Validates attribute responses against service type attributes
 */
function validateServiceAttributes(serviceType: any, attributeResponses: any) {
  if (serviceType.attributes && attributeResponses) {
    const validation = validateAttributeResponses(
      serviceType.attributes as ServiceAttribute[],
      attributeResponses as AttributeResponse[]
    );

    if (!validation.valid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid attribute responses: ${validation.errors.join(", ")}`,
      });
    }
  }
}

/**
 * Calculates total credit cost including base, attributes, and priority
 */
async function calculateTotalCreditCost(
  serviceType: any,
  attributeResponses: any,
  priority: number,
  serviceTypeId: string
) {
  const baseCreditCost = serviceType.creditCost || 1;

  const attributeCredits =
    serviceType.attributes && attributeResponses
      ? calculateAttributeCredits(
          serviceType.attributes as ServiceAttribute[],
          attributeResponses as AttributeResponse[]
        )
      : 0;

  const costs = await getPriorityCostsForService(serviceTypeId);
  const priorityCosts: Record<number, number> = {
    1: costs.low,
    2: costs.medium,
    3: costs.high,
  };
  const priorityCost = priorityCosts[priority] ?? costs.medium;

  return {
    baseCreditCost,
    attributeCredits,
    priorityCost,
    totalCreditCost: baseCreditCost + attributeCredits + priorityCost,
  };
}

/**
 * Notifies providers who support the requested service type
 */
async function notifyMatchingProviders(
  db: any,
  serviceTypeId: string,
  serviceName: string,
  requestTitle: string,
  locale: string
) {
  const providersWithService = await db.providerProfile.findMany({
    where: {
      isActive: true,
      supportedServices: {
        some: {
          id: serviceTypeId,
        },
      },
    },
    select: {
      userId: true,
    },
  });

  if (providersWithService.length > 0) {
    const title = await getTranslation(locale, "notifications.newRequestAvailable.title");
    const message = await getTranslation(locale, "notifications.newRequestAvailable.message", {
      serviceName,
      requestTitle,
    });
    await Promise.all(
      providersWithService.map((provider: { userId: string }) =>
        createNotification({
          userId: provider.userId,
          title,
          message,
          type: "general",
          link: `/provider/available`,
          sendEmail: false,
          locale,
          sseI18n: {
            titleKey: "notifications.newRequestAvailable.title",
            messageKey: "notifications.newRequestAvailable.message",
            messageParams: { serviceName, requestTitle },
          },
        })
      )
    );
  }
}

/**
 * Builds cost breakdown message for the response
 */
function buildCostBreakdownMessage(
  baseCreditCost: number,
  attributeCredits: number,
  priorityCost: number,
  totalCreditCost: number
): string {
  const costBreakdown = [];
  costBreakdown.push(`Base: ${baseCreditCost}`);
  if (attributeCredits > 0) {
    costBreakdown.push(`Attributes: ${attributeCredits}`);
  }
  if (priorityCost > 0) {
    costBreakdown.push(`Priority: ${priorityCost}`);
  }
  const breakdownMessage = costBreakdown.length > 1 ? ` (${costBreakdown.join(" + ")})` : "";

  return `Request created successfully. ${totalCreditCost} credit${totalCreditCost === 1 ? "" : "s"} ${totalCreditCost === 1 ? "has" : "have"} been deducted${breakdownMessage}.`;
}

/**
 * Validates request access based on user role
 */
function validateRequestAccess(userId: string, role: string, request: any) {
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
        title: z.string().min(5, "Title must be at least 5 characters"),
        description: z.string().min(20, "Description must be at least 20 characters"),
        serviceTypeId: z.string(),
        priority: z.number().min(1).max(3).default(1),
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

      // Get service type
      const serviceType = (await ctx.db.serviceType.findUnique({
        where: { id: input.serviceTypeId },
      })) as any;

      if (!serviceType) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Service type not found",
        });
      }

      // Validate subscription and service access
      await validateServiceAccess(ctx.db, userId, input.serviceTypeId, serviceType.name);

      // Validate attribute responses
      validateServiceAttributes(serviceType, input.attributeResponses);

      // Only allow our private upload URLs — blocks javascript: and external phishing.
      try {
        assertAllowedUploadUrls(input.attachments, userId);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid attachment URL. Upload files through the app first.",
        });
      }

      // Calculate total credit cost
      const costDetails = await calculateTotalCreditCost(
        serviceType,
        input.attributeResponses,
        input.priority,
        input.serviceTypeId
      );

      // Deduct credits, create the request, and write the system comment in
      // one transaction: either everything commits or the credits roll back.
      const requestCreatedComment = await getTranslation(
        ctx.locale,
        "requests.messages.systemMessages.requestCreated"
      );

      const { request, creditResult } = await ctx.db.$transaction(async (tx) => {
        const creditResult = await checkAndDeductCredits(
          userId,
          costDetails.totalCreditCost,
          `New request: ${input.title} (Priority ${input.priority})`,
          tx
        );

        if (!creditResult.allowed || !creditResult.success) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: creditResult.message,
          });
        }

        const request = await tx.request.create({
          data: {
            title: input.title,
            description: input.description,
            clientId: userId,
            serviceTypeId: input.serviceTypeId,
            priority: input.priority,
            creditCost: costDetails.totalCreditCost,
            baseCreditCost: costDetails.baseCreditCost,
            attributeCredits: costDetails.attributeCredits,
            priorityCreditCost: costDetails.priorityCost,
            isRevision: false,
            formData: input.formData || {},
            attributeResponses: input.attributeResponses || null,
            attachments: input.attachments || [],
            status: "PENDING",
          } as any,
          include: {
            serviceType: true,
          },
        });

        await tx.requestComment.create({
          data: {
            requestId: request.id,
            userId,
            content: requestCreatedComment,
            type: "SYSTEM",
          },
        });

        return { request, creditResult };
      });

      // Notify matching providers
      await notifyMatchingProviders(
        ctx.db,
        input.serviceTypeId,
        serviceType.name,
        input.title,
        ctx.locale
      );

      // Build success message with cost breakdown
      const message = buildCostBreakdownMessage(
        costDetails.baseCreditCost,
        costDetails.attributeCredits,
        costDetails.priorityCost,
        costDetails.totalCreditCost
      );

      return {
        success: true,
        request,
        creditsRemaining: creditResult.newBalance,
        message,
      };
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
      }
      // SUPER_ADMIN sees all requests

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
              r.providerId === userId
                ? r
                : { ...r, client: { ...r.client, email: null } }
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
            orderBy: { createdAt: "asc" },
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

      // Providers viewing an unassigned pending request must not see client PII.
      const isProviderBrowsing =
        role === "PROVIDER" && request.providerId !== userId;
      const visibleRequest = isProviderBrowsing
        ? {
            ...request,
            client: { ...request.client, email: null },
            comments: [],
          }
        : request;

      // Get revision info if client
      let revisionInfo = null;
      if (role === "CLIENT" || role === "SUPER_ADMIN") {
        revisionInfo = await getRevisionInfo(input.id, request.clientId);
      }

      // Calculate attribute credits with backward compatibility
      const attributeCredits = getAttributeCredits(request);

      return {
        ...visibleRequest,
        attributeCredits,
        revisionInfo,
      } as any;
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

      if (role !== "PROVIDER" && role !== "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only providers can accept requests",
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

      // Notify client
      const acceptedTitle = await getTranslation(ctx.locale, "notifications.requestAccepted.title");
      const acceptedMessage = await getTranslation(
        ctx.locale,
        "notifications.requestAccepted.message",
        {
          requestTitle: request.title,
        }
      );
      await createNotification({
        userId: request.clientId,
        title: acceptedTitle,
        message: acceptedMessage,
        type: "status_change",
        link: `/client/requests/${request.id}`,
        sendEmail: false,
        locale: ctx.locale,
        sseI18n: {
          titleKey: "notifications.requestAccepted.title",
          messageKey: "notifications.requestAccepted.message",
          messageParams: { requestTitle: request.title },
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

      if (request.providerId !== userId && ctx.session.user.role !== "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this request",
        });
      }

      if (
        input.status === "IN_PROGRESS" &&
        request.status !== "IN_PROGRESS" &&
        ctx.session.user.role !== "SUPER_ADMIN" &&
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

      // Notify client
      const statusNotificationKey =
        input.status === "DELIVERED"
          ? "notifications.deliverableReady"
          : "notifications.requestStatusUpdate";
      const statusTitle = await getTranslation(ctx.locale, `${statusNotificationKey}.title`);
      const statusMessage = await getTranslation(ctx.locale, `${statusNotificationKey}.message`, {
        requestTitle: request.title,
      });

      await createNotification({
        userId: request.clientId,
        title: statusTitle,
        message: statusMessage,
        type: "status_change",
        link: `/client/requests/${request.id}`,
        sendEmail: false,
        locale: ctx.locale,
        sseI18n: {
          titleKey: `${statusNotificationKey}.title`,
          messageKey: `${statusNotificationKey}.message`,
          messageParams: { requestTitle: request.title },
        },
      });

      return {
        success: true,
        request: updatedRequest,
      };
    }),

  // Request revision (client)
  requestRevision: clientProcedure
    .input(
      z.object({
        requestId: z.string(),
        feedback: z.string().min(10, "Please provide detailed feedback"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Use the smart revision logic
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

      return result;
    }),

  // Approve request (client)
  approve: clientProcedure
    .input(z.object({ requestId: z.string() }))
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

      if (request.status !== "DELIVERED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Request must be in DELIVERED status to approve",
        });
      }

      const approvedComment = await getTranslation(
        ctx.locale,
        "requests.messages.systemMessages.requestApprovedCompleted"
      );

      const updatedRequest = await ctx.db.$transaction(async (tx) => {
        // CAS: only complete while still DELIVERED and not soft-deleted
        const cas = await tx.request.updateMany({
          where: {
            id: input.requestId,
            status: "DELIVERED",
            deletedAt: null,
            clientId: userId,
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
          await settleCompletedRequest(tx, input.requestId);
        }

        await tx.requestComment.create({
          data: {
            requestId: input.requestId,
            userId,
            content: approvedComment,
            type: "SYSTEM",
          },
        });

        return tx.request.findUnique({ where: { id: input.requestId } });
      });

      // Notify provider
      if (request.providerId) {
        // Send realtime + email notification
        await notifyStatusChange({
          requestId: input.requestId,
          userId: request.providerId,
          oldStatus: "DELIVERED",
          newStatus: "COMPLETED",
          locale: ctx.locale,
        });
      }

      return {
        success: true,
        request: updatedRequest,
      };
    }),

  // Add comment to request
  addComment: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        content: z.string().min(1),
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

      if (!request.providerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Messaging is available after a provider claims this request",
        });
      }

      // Check access
      const isClient = request.clientId === userId;
      const isProvider = request.providerId === userId;
      const isAdmin = ctx.session.user.role === "SUPER_ADMIN";

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
      const isProviderRole = ctx.session.user.role === "PROVIDER";
      if (isClient) {
        await notifyNewMessage({
          requestId: input.requestId,
          senderName,
          senderRole: "CLIENT",
          recipientId: request.providerId,
          messagePreview: input.content.slice(0, 100),
          locale: ctx.locale,
        });
      } else {
        // Non-client commented (provider/admin) - notify client
        // Mask provider identity for client-facing notifications
        const brandProviderName = await getTranslation(
          ctx.locale,
          "requests.sidebar.brandProviderName"
        );
        const maskedSenderName = isProviderRole ? brandProviderName : senderName;
        await notifyNewMessage({
          requestId: input.requestId,
          senderName: maskedSenderName,
          recipientId: request.clientId,
          messagePreview: input.content.slice(0, 100),
          locale: ctx.locale,
        });
      }

      return comment;
    }),

  // Submit rating (client)
  rate: clientProcedure
    .input(
      z.object({
        requestId: z.string(),
        rating: z.number().min(1).max(5),
        reviewText: z.string().optional(),
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
          message: "No provider assigned to this request",
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

      const rating = await ctx.db.rating.create({
        data: {
          requestId: input.requestId,
          clientId: userId,
          providerId: request.providerId,
          rating: input.rating,
          reviewText: input.reviewText,
        },
      });

      // Send real-time notification to provider
      const ratingTitle = await getTranslation(ctx.locale, "notifications.ratingSubmitted.title");
      const ratingMessage = await getTranslation(
        ctx.locale,
        "notifications.ratingSubmitted.message",
        {
          rating: input.rating,
          requestTitle: request.title,
        }
      );
      await createNotification({
        userId: request.providerId,
        title: ratingTitle,
        message: ratingMessage,
        type: "general",
        link: `/provider/requests/${request.id}`,
        sendEmail: false,
        locale: ctx.locale,
        sseI18n: {
          titleKey: "notifications.ratingSubmitted.title",
          messageKey: "notifications.ratingSubmitted.message",
          messageParams: { rating: input.rating.toString(), requestTitle: request.title },
        },
      });

      return {
        success: true,
        rating,
      };
    }),

  // Get service types
  getServiceTypes: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Get user's active subscription with package services
    const activeSubscription = (await ctx.db.clientSubscription.findFirst({
      where: {
        userId: userId,
        isActive: true,
        endDate: { gte: new Date() },
      },
      include: {
        package: {
          include: {
            services: {
              include: {
                serviceType: true,
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

    // Get all active services with their package support info
    const allServices = await ctx.db.serviceType.findMany({
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
        priorityCostLow: true,
        priorityCostMedium: true,
        priorityCostHigh: true,
        isActive: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    // Get all packages that support each service
    const packageServices = await ctx.db.packageService.findMany({
      include: { package: true },
    });

    // Create a map of service ID to packages that support it
    const servicePackageMap = new Map<string, any[]>();
    packageServices.forEach((ps) => {
      const serviceId = ps.serviceId;
      if (!servicePackageMap.has(serviceId)) {
        servicePackageMap.set(serviceId, []);
      }
      servicePackageMap.get(serviceId)!.push(ps.package);
    });

    // Check if package supports all services
    const supportAllServices = activeSubscription.package.supportAllServices;

    // Get allowed service IDs if package doesn't support all
    const allowedServiceIds = supportAllServices
      ? null
      : new Set(
          activeSubscription.package.services.map((ps: { serviceType: any }) => ps.serviceType.id)
        );

    // Return all services with isSupported flag and supportingPackages
    return allServices.map((service: any) => {
      const isSupported = supportAllServices || allowedServiceIds?.has(service.id) || false;
      const supportingPackages = servicePackageMap.get(service.id) || [];

      return {
        ...service,
        isSupported,
        supportingPackages: supportingPackages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          nameI18n: pkg.nameI18n,
        })),
      };
    });
  }),
});
