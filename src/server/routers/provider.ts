import { z } from "zod";
import { router, providerProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { notifyAdminsNewWithdrawal, notifyStatusChange } from "@/lib/notifications";
import { formatEstimatedDeliveryDuration, getTranslation } from "@/lib/notifications/i18n-helper";
import {
  normalizePayoutDetails,
  requestProviderWithdrawal,
} from "@/lib/provider-wallet";

const payoutDetailsInputSchema = z.object({
  payoutMethod: z.enum(["BANK", "E_WALLET"]),
  accountHolder: z.string().min(2).max(120),
  bankName: z.string().max(120).optional().nullable(),
  bankAccount: z.string().max(80).optional().nullable(),
  eWalletNumber: z.string().max(40).optional().nullable(),
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
        pendingCredits: z.number(),
        paidCredits: z.number(),
        balanceEgp: z.number(),
        pendingEgp: z.number(),
        paidEgp: z.number(),
        totalEarningsEgp: z.number(),
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
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // Period window is for the "earnings this period" summary cards only.
      // The ledger/withdrawal history always returns full history so older
      // settlements remain visible while balance still includes them.
      const startDate = input?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = input?.endDate || new Date();

      const [wallet, ledger, periodLedger, profile, withdrawals] = await Promise.all([
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
          },
          orderBy: { settledAt: "desc" },
          take: 100,
        }),
        ctx.db.providerFinanceLedger.findMany({
          where: {
            providerId: userId,
            settledAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            providerCredits: true,
            providerAmountEgp: true,
          },
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
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);

      const completedRequests = ledger.map((entry) => ({
        ...entry.request,
        serviceType: entry.serviceType,
        finance: {
          totalCredits: entry.totalCredits,
          providerCredits: entry.providerCredits,
          creditPriceEgp: entry.creditPriceEgp,
          totalAmountEgp: entry.totalAmountEgp,
          providerAmountEgp: entry.providerAmountEgp,
          status: entry.status,
          settledAt: entry.settledAt,
        },
      }));

      const periodTotals = periodLedger.reduce(
        (
          sum: {
            providerCredits: number;
            providerAmountEgp: number;
          },
          entry
        ) => ({
          providerCredits: sum.providerCredits + entry.providerCredits,
          providerAmountEgp: sum.providerAmountEgp + entry.providerAmountEgp,
        }),
        { providerCredits: 0, providerAmountEgp: 0 }
      );

      return {
        totalEarnings: periodTotals.providerCredits,
        completedCount: periodLedger.length,
        balanceCredits: wallet?.balanceCredits ?? 0,
        pendingCredits: wallet?.pendingCredits ?? 0,
        paidCredits: wallet?.paidCredits ?? 0,
        balanceEgp: wallet?.balanceEgp ?? 0,
        pendingEgp: wallet?.pendingEgp ?? 0,
        paidEgp: wallet?.paidEgp ?? 0,
        totalEarningsEgp: periodTotals.providerAmountEgp,
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

      if (
        request.providerId !== userId &&
        !supportedServiceIds.includes(request.serviceTypeId)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This request is not in your supported services",
        });
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
          .min(15, "Estimated delivery time must be at least 15 minutes")
          .max(480, "Estimated delivery time cannot exceed 480 minutes (8 hours)"),
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

      if (request.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only pending requests can be started",
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
        deliverableMessage: z.string().min(5, "Deliverable message must be at least 5 characters"),
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

      // Update request status
      const updatedRequest = await ctx.db.request.update({
        where: { id: input.requestId },
        data: { status: "DELIVERED" },
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
        amountEgp: z.number().positive(),
        providerNote: z.string().max(500).optional().nullable(),
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
          amountEgp: input.amountEgp,
          providerNote: input.providerNote,
        })
      );

      const providerNameOrEmail = ctx.session.user.name || ctx.session.user.email || "Provider";
      await notifyAdminsNewWithdrawal({
        providerNameOrEmail,
        amountEgp: withdrawal.amountEgp,
        locale: ctx.locale,
      });

      return { success: true, withdrawalId: withdrawal.id };
    }),
});
