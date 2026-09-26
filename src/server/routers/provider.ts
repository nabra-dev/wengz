import { z } from "zod";
import { router, providerProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import {
  notifyAdminsNewWithdrawal,
  notifyAdminsFinanceDisputeOpened,
  notifyStatusChange,
} from "@/lib/notifications";
import { formatEstimatedDeliveryDuration, getTranslation } from "@/lib/notifications/i18n-helper";
import { normalizePayoutDetails, requestProviderWithdrawal } from "@/lib/provider-wallet";
import { openProviderFinanceDispute } from "@/lib/finance-disputes";
import { getFinanceSettings } from "@/lib/finance-settings";
import { logActivityAsync } from "@/lib/activity-log";
import { logRequestActivity } from "@/lib/request-activity";
import {
  getProviderWorkload,
  canClaimAdditionalRequest,
  canStartNewInProgressWork,
  PROVIDER_AT_CAPACITY_MESSAGE,
} from "@/lib/provider-workload";

const payoutDetailsInputSchema = z.object({
  payoutMethod: z.enum(["BANK", "E_WALLET"]),
  accountHolder: z.string().min(1),
  bankName: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  eWalletNumber: z.string().optional().nullable(),
});

export const providerRouter = router({
  // Get provider profile
  getProfile: providerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/provider/profile",
        tags: ["provider"],
        summary: "Get provider profile",
      },
    })
    .input(z.void())
    .output(z.any())
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      const profile = await ctx.db.providerProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true, createdAt: true },
          },
        },
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Provider profile not found",
        });
      }

      return profile;
    }),

  // Update provider profile
  updateProfile: providerProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/provider/profile",
        tags: ["provider"],
        summary: "Update provider profile",
      },
    })
    .input(
      z.object({
        bio: z.string().optional(),
        portfolio: z.string().url().optional().or(z.literal("")),
        skillsTags: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .output(z.object({ success: z.boolean(), profile: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const profile = await ctx.db.providerProfile.upsert({
        where: { userId },
        update: input,
        create: {
          userId,
          ...input,
        },
      });

      return {
        success: true,
        profile,
      };
    }),

  // Get provider stats
  getStats: providerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/provider/stats",
        tags: ["provider"],
        summary: "Get provider stats",
      },
    })
    .input(z.void())
    .output(
      z.object({
        totalRequests: z.number(),
        completedRequests: z.number(),
        activeRequests: z.number(),
        pendingRequests: z.number(),
        averageRating: z.number(),
        totalRatings: z.number(),
      })
    )
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      const [totalRequests, completedRequests, activeRequests, pendingRequests, ratings] =
        await Promise.all([
          ctx.db.request.count({ where: { providerId: userId } }),
          ctx.db.request.count({ where: { providerId: userId, status: "COMPLETED" } }),
          ctx.db.request.count({
            where: {
              providerId: userId,
              status: { in: ["IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED"] },
            },
          }),
          ctx.db.request.count({
            where: { providerId: null, status: "PENDING" },
          }),
          ctx.db.rating.aggregate({
            where: { providerId: userId },
            _avg: { rating: true },
            _count: true,
          }),
        ]);

      return {
        totalRequests,
        completedRequests,
        activeRequests,
        pendingRequests,
        averageRating: ratings._avg.rating || 0,
        totalRatings: ratings._count,
      };
    }),

  // Get available requests (pending, matching provider's supported services)
  getAvailableRequests: providerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/provider/available-requests",
        tags: ["provider"],
        summary: "List available requests",
      },
    })
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(20),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .output(z.object({ requests: z.array(z.any()), nextCursor: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get provider's supported services
      const providerProfile = await ctx.db.providerProfile.findUnique({
        where: { userId },
        include: {
          supportedServices: {
            select: { id: true },
          },
        },
      });

      // Get the service IDs this provider supports
      const supportedServiceIds =
        providerProfile?.supportedServices.map((s: { id: string }) => s.id) || [];

      // If no supported services configured, return empty (provider must have services assigned)
      if (supportedServiceIds.length === 0) {
        return {
          requests: [],
          nextCursor: null,
        };
      }

      // Build the where clause - only show requests matching provider's services
      const whereClause = {
        status: "PENDING" as const,
        providerId: null,
        serviceTypeId: { in: supportedServiceIds },
      };

      const requests = await ctx.db.request.findMany({
        where: whereClause,
        include: {
          client: {
            select: { id: true, name: true, image: true },
          },
          serviceType: true,
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: input?.limit || 20,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        skip: input?.cursor ? 1 : 0,
      });

      // Use stored credit cost from database
      return {
        requests,
        nextCursor: requests.length === (input?.limit || 20) ? (requests.at(-1)?.id ?? null) : null,
      };
    }),

  // Get my requests (as provider)
  getMyRequests: providerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/provider/my-requests",
        tags: ["provider"],
        summary: "List my requests",
      },
    })
    .input(
      z
        .object({
          status: z
            .enum(["IN_PROGRESS", "DELIVERED", "REVISION_REQUESTED", "COMPLETED"])
            .optional(),
          limit: z.number().min(1).max(50).default(20),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .output(z.object({ requests: z.array(z.any()), nextCursor: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const where: any = { providerId: userId };
      if (input?.status) {
        where.status = input.status;
      }

      const requests = await ctx.db.request.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true, email: true, image: true },
          },
          serviceType: true,
          rating: true,
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: input?.limit || 20,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        skip: input?.cursor ? 1 : 0,
      });

      // Use stored credit cost from database
      return {
        requests,
        nextCursor: requests.length === (input?.limit || 20) ? (requests.at(-1)?.id ?? null) : null,
      };
    }),

  // Get earnings summary
  getEarnings: providerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/provider/earnings",
        tags: ["provider"],
        summary: "Get earnings summary",
      },
    })
    .input(
      z
        .object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
        .optional()
    )
    .output(
      z.object({
        totalEarnings: z.number(),
        completedCount: z.number(),
        balanceCredits: z.number(),
        heldCredits: z.number(),
        pendingCredits: z.number(),
        paidCredits: z.number(),
        balanceUsd: z.number(),
        heldUsd: z.number(),
        pendingUsd: z.number(),
        paidUsd: z.number(),
        totalEarningsUsd: z.number(),
        period: z.object({ start: z.date(), end: z.date() }),
        requests: z.array(z.any()),
        ledger: z.array(z.any()),
        payout: z
          .object({
            payoutMethod: z.enum(["BANK", "E_WALLET"]).nullable(),
            accountHolder: z.string().nullable(),
            bankName: z.string().nullable(),
            bankAccount: z.string().nullable(),
            eWalletNumber: z.string().nullable(),
          })
          .nullable(),
        withdrawals: z.array(z.any()),
        hasPendingWithdrawal: z.boolean(),
        withdrawalSettings: z.object({
          minWithdrawalUsd: z.number(),
          withdrawalFeeUsd: z.number(),
        }),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // Period window is for the "earnings this period" summary cards only.
      // The ledger/withdrawal history always returns full history so older
      // settlements remain visible while balance still includes them.
      const startDate = input?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = input?.endDate || new Date();

      const [wallet, ledger, periodAgg, profile, withdrawals, financeSettings] = await Promise.all([
        ctx.db.providerWallet.findUnique({
          where: { providerId: userId },
        }),
        ctx.db.providerFinanceLedger.findMany({
          where: { providerId: userId },
          include: {
            request: {
              select: {
                id: true,
                title: true,
                status: true,
                completedAt: true,
                creditCost: true,
              },
            },
            serviceType: {
              select: {
                id: true,
                name: true,
                nameI18n: true,
                icon: true,
              },
            },
            disputes: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                reason: true,
                status: true,
                adminNote: true,
                createdAt: true,
                reviewedAt: true,
              },
            },
          },
          orderBy: { settledAt: "desc" },
          take: 100,
        }),
        ctx.db.providerFinanceLedger.aggregate({
          where: {
            providerId: userId,
            settledAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          _sum: {
            providerCredits: true,
            providerAmountUsd: true,
          },
          _count: true,
        }),
        ctx.db.providerProfile.findUnique({
          where: { userId },
          select: {
            payoutMethod: true,
            accountHolder: true,
            bankName: true,
            bankAccount: true,
            eWalletNumber: true,
          },
        }),
        ctx.db.withdrawalRequest.findMany({
          where: { providerId: userId },
          include: {
            reviewedBy: {
              select: { id: true, name: true, email: true },
            },
            disputes: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                reason: true,
                status: true,
                adminNote: true,
                createdAt: true,
                reviewedAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        getFinanceSettings(ctx.db),
      ]);

      const completedRequests = ledger.map((entry) => ({
        ...entry.request,
        serviceType: entry.serviceType,
        finance: {
          totalCredits: entry.totalCredits,
          providerCredits: entry.providerCredits,
          platformCredits: entry.platformCredits,
          creditPriceUsd: entry.creditPriceUsd,
          commissionPercent: entry.commissionPercent,
          totalAmountUsd: entry.totalAmountUsd,
          platformAmountUsd: entry.platformAmountUsd,
          providerAmountUsd: entry.providerAmountUsd,
          status: entry.status,
          settledAt: entry.settledAt,
          availableAt: entry.availableAt,
        },
      }));

      return {
        totalEarnings: periodAgg._sum.providerCredits ?? 0,
        completedCount: periodAgg._count,
        balanceCredits: wallet?.balanceCredits ?? 0,
        heldCredits: wallet?.heldCredits ?? 0,
        pendingCredits: wallet?.pendingCredits ?? 0,
        paidCredits: wallet?.paidCredits ?? 0,
        balanceUsd: wallet?.balanceUsd ?? 0,
        heldUsd: wallet?.heldUsd ?? 0,
        pendingUsd: wallet?.pendingUsd ?? 0,
        paidUsd: wallet?.paidUsd ?? 0,
        totalEarningsUsd: periodAgg._sum.providerAmountUsd ?? 0,
        period: {
          start: startDate,
          end: endDate,
        },
        requests: completedRequests,
        ledger,
        payout: profile
          ? {
              payoutMethod: profile.payoutMethod,
              accountHolder: profile.accountHolder,
              bankName: profile.bankName,
              bankAccount: profile.bankAccount,
              eWalletNumber: profile.eWalletNumber,
            }
          : null,
        withdrawals,
        hasPendingWithdrawal: withdrawals.some((item) => item.status === "PENDING"),
        withdrawalSettings: {
          minWithdrawalUsd: financeSettings.minWithdrawalUsd,
          withdrawalFeeUsd: financeSettings.withdrawalFeeUsd,
        },
      };
    }),

  // Get completed requests that have not yet been settled into a wallet.
  getUnsettledCompletedRequests: providerProcedure
    .output(z.array(z.any()))
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      return ctx.db.request.findMany({
        where: {
          providerId: userId,
          status: "COMPLETED",
          providerFinance: null,
        },
        include: {
          serviceType: true,
        },
      });
    }),

  // Get recent reviews
  getReviews: providerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/provider/reviews",
        tags: ["provider"],
        summary: "List recent reviews",
      },
    })
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(10),
        })
        .optional()
    )
    .output(z.array(z.any()))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const reviews = await ctx.db.rating.findMany({
        where: { providerId: userId },
        include: {
          client: {
            select: { id: true, name: true, image: true },
          },
          request: {
            select: { id: true, title: true, serviceType: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input?.limit || 10,
      });

      return reviews;
    }),

  // Claim a request
  claimRequest: providerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/provider/claim-request",
        tags: ["provider"],
        summary: "Claim a pending request",
      },
    })
    .input(z.object({ requestId: z.string() }))
    .output(z.object({ success: z.boolean(), request: z.any() }))
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

      if (request.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending requests can be claimed",
        });
      }

      // Enforce skill match: providers may only claim requests for service
      // types they support (same rule as getAvailableRequests).
      const providerProfile = await ctx.db.providerProfile.findUnique({
        where: { userId },
        include: { supportedServices: { select: { id: true } } },
      });
      const supportedServiceIds =
        providerProfile?.supportedServices.map((s: { id: string }) => s.id) || [];

      if (request.providerId !== userId && !supportedServiceIds.includes(request.serviceTypeId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This request is not in your supported services",
        });
      }

      // Light capacity guard for new claims only (already-assigned PENDING is fine)
      if (request.providerId !== userId) {
        const workload = await getProviderWorkload(userId);
        if (!canClaimAdditionalRequest(workload)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: PROVIDER_AT_CAPACITY_MESSAGE,
          });
        }
      }

      // Atomic claim: only succeeds if the request is still pending and
      // unassigned (or already ours). Prevents two providers claiming at once.
      const claimed = await ctx.db.request.updateMany({
        where: {
          id: input.requestId,
          status: "PENDING",
          OR: [{ providerId: null }, { providerId: userId }],
        },
        data: { providerId: userId },
      });

      if (claimed.count === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request has already been claimed",
        });
      }

      const updatedRequest = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      // Send notification about provider assignment
      await notifyStatusChange({
        requestId: input.requestId,
        userId: request.clientId,
        oldStatus: "PENDING",
        newStatus: "IN_PROGRESS",
        locale: ctx.locale,
      });

      logRequestActivity({
        action: "request.claim",
        requestId: input.requestId,
        actorId: userId,
        actorRole: ctx.session.user.role,
        message: `Request claimed: ${request.title}`,
        metadata: {
          previousProviderId: request.providerId,
          newProviderId: userId,
        },
      });

      return { success: true, request: updatedRequest };
    }),

  // Start working on a request
  startWork: providerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/provider/start-work",
        tags: ["provider"],
        summary: "Start working on a request",
      },
    })
    .input(
      z.object({
        requestId: z.string(),
        estimatedDeliveryMinutes: z
          .number()
          .min(15, "Estimated delivery time must be at least 15 minutes"),
      })
    )
    .output(z.object({ success: z.boolean(), request: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
        include: {
          serviceType: {
            select: { maxDeliveryMinutes: true },
          },
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      if (request.providerId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this request",
        });
      }

      if (request.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending requests can be started",
        });
      }

      const workload = await getProviderWorkload(userId);
      if (!canStartNewInProgressWork(workload)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: PROVIDER_AT_CAPACITY_MESSAGE,
        });
      }

      const maxDeliveryMinutes = request.serviceType.maxDeliveryMinutes ?? 480;
      if (input.estimatedDeliveryMinutes > maxDeliveryMinutes) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Estimated delivery time cannot exceed ${maxDeliveryMinutes} minutes`,
        });
      }

      // Calculate estimated delivery date
      const estimatedDelivery = new Date();
      estimatedDelivery.setMinutes(estimatedDelivery.getMinutes() + input.estimatedDeliveryMinutes);

      const updatedRequest = await ctx.db.request.update({
        where: { id: input.requestId },
        data: {
          status: "IN_PROGRESS",
          estimatedDelivery,
        },
      });

      // Add system comment with estimated delivery time (fully localized units)
      const deliveryTimeText = await formatEstimatedDeliveryDuration(
        ctx.locale,
        input.estimatedDeliveryMinutes
      );

      const providerStartedWorkComment = await getTranslation(
        ctx.locale,
        "requests.messages.systemMessages.providerStartedWork",
        {
          deliveryTime: deliveryTimeText,
        }
      );

      await ctx.db.requestComment.create({
        data: {
          requestId: input.requestId,
          userId,
          type: "SYSTEM",
          content: providerStartedWorkComment,
        },
      });

      // Send notification about work starting
      await notifyStatusChange({
        requestId: input.requestId,
        userId: request.clientId,
        oldStatus: "PENDING",
        newStatus: "IN_PROGRESS",
        locale: ctx.locale,
      });

      logRequestActivity({
        action: "request.start",
        requestId: input.requestId,
        actorId: userId,
        actorRole: ctx.session.user.role,
        message: `Work started: ${request.title}`,
        metadata: {
          estimatedDeliveryMinutes: input.estimatedDeliveryMinutes,
          estimatedDelivery: estimatedDelivery.toISOString(),
          previousStatus: request.status,
          newStatus: "IN_PROGRESS",
        },
      });

      return { success: true, request: updatedRequest };
    }),

  // Deliver work
  deliverWork: providerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/provider/deliver-work",
        tags: ["provider"],
        summary: "Deliver work for a request",
      },
    })
    .input(
      z.object({
        requestId: z.string(),
        deliverableMessage: z.string().min(1, "Deliverable message is required"),
        files: z.array(z.string()).optional(),
      })
    )
    .output(z.object({ success: z.boolean(), request: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      if (request.providerId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this request",
        });
      }

      if (!["IN_PROGRESS", "REVISION_REQUESTED"].includes(request.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Request must be in progress or revision requested to deliver",
        });
      }

      // Update request status — fresh delivery resets approval SLA timers
      const updatedRequest = await ctx.db.request.update({
        where: { id: input.requestId },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          approvalReminderSentAt: null,
          needsManualApproval: false,
        },
      });

      // Add deliverable comment
      await ctx.db.requestComment.create({
        data: {
          requestId: input.requestId,
          userId,
          type: "DELIVERABLE",
          content: input.deliverableMessage,
          files: input.files || [],
        },
      });

      // Send notification about deliverable
      await notifyStatusChange({
        requestId: input.requestId,
        userId: request.clientId,
        oldStatus: request.status,
        newStatus: "DELIVERED",
        locale: ctx.locale,
      });

      logRequestActivity({
        action: "request.deliver",
        requestId: input.requestId,
        actorId: userId,
        actorRole: ctx.session.user.role,
        message: `Work delivered: ${request.title}`,
        reason: input.deliverableMessage,
        metadata: {
          previousStatus: request.status,
          newStatus: "DELIVERED",
          fileCount: input.files?.length ?? 0,
        },
      });

      return { success: true, request: updatedRequest };
    }),

  updatePayoutDetails: providerProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/provider/payout-details",
        tags: ["provider"],
        summary: "Save provider payout details",
      },
    })
    .input(payoutDetailsInputSchema)
    .output(
      z.object({
        success: z.boolean(),
        payout: z.object({
          payoutMethod: z.enum(["BANK", "E_WALLET"]),
          accountHolder: z.string(),
          bankName: z.string().nullable(),
          bankAccount: z.string().nullable(),
          eWalletNumber: z.string().nullable(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payout = normalizePayoutDetails(input);
      const userId = ctx.session.user.id;

      const profile = await ctx.db.providerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Provider profile not found",
        });
      }

      await ctx.db.providerProfile.update({
        where: { userId },
        data: {
          payoutMethod: payout.payoutMethod,
          accountHolder: payout.accountHolder,
          bankName: payout.bankName,
          bankAccount: payout.bankAccount,
          eWalletNumber: payout.eWalletNumber,
        },
      });

      return { success: true, payout };
    }),

  requestWithdrawal: providerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/provider/withdrawals",
        tags: ["provider"],
        summary: "Request a wallet withdrawal",
      },
    })
    .input(
      z.object({
        amountUsd: z.number().positive(),
        providerNote: z.string().optional().nullable(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        withdrawalId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const withdrawal = await ctx.db.$transaction((tx) =>
        requestProviderWithdrawal(tx, {
          providerId: userId,
          amountUsd: input.amountUsd,
          providerNote: input.providerNote,
        })
      );

      const providerNameOrEmail = ctx.session.user.name || ctx.session.user.email || "Provider";
      await notifyAdminsNewWithdrawal({
        providerNameOrEmail,
        amountUsd: withdrawal.amountUsd,
        locale: ctx.locale,
      });

      return { success: true, withdrawalId: withdrawal.id };
    }),

  openFinanceDispute: providerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/provider/finance/disputes",
        tags: ["provider"],
        summary: "Open a dispute on a ledger entry or withdrawal",
      },
    })
    .input(
      z
        .object({
          reason: z.string().min(1),
          ledgerId: z.string().optional().nullable(),
          withdrawalId: z.string().optional().nullable(),
        })
        .refine((value) => Boolean(value.ledgerId) !== Boolean(value.withdrawalId), {
          message: "Provide exactly one of ledgerId or withdrawalId",
        })
    )
    .output(z.object({ success: z.boolean(), disputeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const dispute = await ctx.db.$transaction((tx) =>
        openProviderFinanceDispute(tx, {
          providerId: userId,
          reason: input.reason,
          ledgerId: input.ledgerId,
          withdrawalId: input.withdrawalId,
        })
      );

      const providerNameOrEmail = ctx.session.user.name || ctx.session.user.email || "Provider";
      await notifyAdminsFinanceDisputeOpened({
        providerNameOrEmail,
        locale: ctx.locale,
      });

      logActivityAsync({
        action: "wallet.dispute_open",
        message: "Provider opened a finance dispute",
        actorId: userId,
        actorRole: "PROVIDER",
        entityType: "ProviderFinanceDispute",
        entityId: dispute.id,
        metadata: {
          ledgerId: dispute.ledgerId,
          withdrawalId: dispute.withdrawalId,
        },
      });

      return { success: true, disputeId: dispute.id };
    }),
});
