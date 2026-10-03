import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  router,
  adminProcedure,
  financeManagerProcedure,
  publicProcedure,
  requestManagerProcedure,
} from "@/server/trpc";
import { ASSIGNABLE_ROLES, ALL_ROLES, getRoleChangeBlockReason, isSuperAdmin } from "@/lib/roles";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import {
  notifyProviderAssignment,
  notifyProviderWithdrawalReviewed,
  notifyProviderFinanceDisputeReviewed,
  notifyProviderUnassigned,
  notifyRequestCancelled,
  notifyRequestRestored,
  notifyAccountActivationChanged,
  notifyEmailChanged,
  notifyRoleChanged,
  sendWelcomeEmail,
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
} from "@/lib/notifications";
import { passwordSchema, phoneWithCountryCodeSchema } from "@/lib/validations";
import { issuePasswordResetEmail } from "@/lib/issue-password-reset";
import { assignFreeClientSubscription } from "@/lib/free-client-subscription";
import {
  reviewProviderWithdrawal,
  sendProviderPayout,
  settleCompletedRequest,
} from "@/lib/provider-wallet";
import { reviewProviderFinanceDispute } from "@/lib/finance-disputes";
import { logActivityAsync } from "@/lib/activity-log";
import { logRequestActivity } from "@/lib/request-activity";
import {
  CREDIT_PRICE_USD_KEY,
  getFinanceSettings as loadFinanceSettings,
  MIN_WITHDRAWAL_USD_KEY,
  PROVIDER_COMMISSION_PERCENT_KEY,
  WITHDRAWAL_FEE_USD_KEY,
} from "@/lib/finance-settings";
import {
  getPaymentSettings as loadPaymentSettings,
  PAYMENT_INSTRUCTIONS_KEY,
  type ManualPaymentSettings,
} from "@/lib/payment-settings";
import { getOrSetCached, cacheKeys, cacheTTL } from "@/lib/cache";
import {
  invalidatePackageCache,
  invalidateServiceTypesCache,
  invalidateServiceTypeCache,
} from "@/lib/cache-invalidation";
import { invalidateSessionUserCache } from "@/lib/session-user-cache";
import { roundMoney } from "@/lib/utils";
import { assertAllowedUploadUrls } from "@/lib/upload-url";
import { createServiceRequest } from "@/lib/create-request";
import {
  clearContactLeakStrikes as clearContactLeakStrikesForUser,
  getContactLeakStrikeState,
} from "@/lib/contact-leak-enforce";

/** Only one package may be featured; clears `isFeatured` on all other rows. */
async function clearFeaturedExcept(db: PrismaClient, keepId: string) {
  await db.package.updateMany({
    where: { id: { not: keepId } },
    data: { isFeatured: false },
  });
}

export const adminRouter = router({
  // Public app state for landing/auth UI
  getPublicAppState: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/app-state/public",
        tags: ["admin"],
        summary: "Get public app state",
      },
    })
    .input(z.void())
    .output(
      z.object({
        maintenanceMode: z.boolean(),
      })
    )
    .query(async ({ ctx }) => {
      const setting = await ctx.db.systemSettings.findUnique({
        where: { key: "maintenance_mode" },
        select: { value: true },
      });

      const value = setting?.value as { enabled?: boolean } | null | undefined;
      return {
        maintenanceMode: Boolean(value?.enabled),
      };
    }),

  // Admin maintenance mode controls
  getMaintenanceMode: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/settings/maintenance",
        tags: ["admin"],
        summary: "Get maintenance mode status",
      },
    })
    .input(z.void())
    .output(
      z.object({
        enabled: z.boolean(),
        updatedAt: z.date().nullable(),
      })
    )
    .query(async ({ ctx }) => {
      const setting = await ctx.db.systemSettings.findUnique({
        where: { key: "maintenance_mode" },
        select: { value: true, updatedAt: true },
      });

      const value = setting?.value as { enabled?: boolean } | null | undefined;
      return {
        enabled: Boolean(value?.enabled),
        updatedAt: setting?.updatedAt ?? null,
      };
    }),

  setMaintenanceMode: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/settings/maintenance",
        tags: ["admin"],
        summary: "Set maintenance mode status",
      },
    })
    .input(
      z.object({
        enabled: z.boolean(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.systemSettings.upsert({
        where: { key: "maintenance_mode" },
        update: {
          value: { enabled: input.enabled },
          description: "When enabled, only SUPER_ADMIN users can log in.",
        },
        create: {
          key: "maintenance_mode",
          value: { enabled: input.enabled },
          description: "When enabled, only SUPER_ADMIN users can log in.",
        },
        select: { value: true },
      });

      const value = updated.value as { enabled?: boolean } | null | undefined;
      return {
        success: true,
        enabled: Boolean(value?.enabled),
      };
    }),

  getFinanceSettings: financeManagerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/settings/finance",
        tags: ["admin"],
        summary: "Get global credit price and commission settings",
      },
    })
    .input(z.void())
    .output(
      z.object({
        creditPriceUsd: z.number(),
        commissionPercent: z.number(),
        minWithdrawalUsd: z.number(),
        withdrawalFeeUsd: z.number(),
      })
    )
    .query(async ({ ctx }) => loadFinanceSettings(ctx.db)),

  setFinanceSettings: financeManagerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/settings/finance",
        tags: ["admin"],
        summary: "Set global credit price and commission settings",
      },
    })
    .input(
      z.object({
        creditPriceUsd: z.number().min(0),
        commissionPercent: z.number().min(0).max(100),
        minWithdrawalUsd: z.number().min(0),
        withdrawalFeeUsd: z.number().min(0),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        creditPriceUsd: z.number(),
        commissionPercent: z.number(),
        minWithdrawalUsd: z.number(),
        withdrawalFeeUsd: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const creditPriceUsd = roundMoney(input.creditPriceUsd);
      const minWithdrawalUsd = roundMoney(input.minWithdrawalUsd);
      const withdrawalFeeUsd = roundMoney(input.withdrawalFeeUsd);

      if (withdrawalFeeUsd > 0 && minWithdrawalUsd > 0 && withdrawalFeeUsd >= minWithdrawalUsd) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Withdrawal fee must be less than the minimum withdrawal amount",
        });
      }

      await ctx.db.$transaction([
        ctx.db.systemSettings.upsert({
          where: { key: CREDIT_PRICE_USD_KEY },
          update: {
            value: { amount: creditPriceUsd },
            description: "Global USD value of one credit for provider settlement.",
          },
          create: {
            key: CREDIT_PRICE_USD_KEY,
            value: { amount: creditPriceUsd },
            description: "Global USD value of one credit for provider settlement.",
          },
        }),
        ctx.db.systemSettings.upsert({
          where: { key: PROVIDER_COMMISSION_PERCENT_KEY },
          update: {
            value: { percent: input.commissionPercent },
            description: "Platform commission percent taken from provider settlement.",
          },
          create: {
            key: PROVIDER_COMMISSION_PERCENT_KEY,
            value: { percent: input.commissionPercent },
            description: "Platform commission percent taken from provider settlement.",
          },
        }),
        ctx.db.systemSettings.upsert({
          where: { key: MIN_WITHDRAWAL_USD_KEY },
          update: {
            value: { amount: minWithdrawalUsd },
            description: "Minimum USD amount a provider may request to withdraw.",
          },
          create: {
            key: MIN_WITHDRAWAL_USD_KEY,
            value: { amount: minWithdrawalUsd },
            description: "Minimum USD amount a provider may request to withdraw.",
          },
        }),
        ctx.db.systemSettings.upsert({
          where: { key: WITHDRAWAL_FEE_USD_KEY },
          update: {
            value: { amount: withdrawalFeeUsd },
            description:
              "Fixed USD fee deducted from provider withdrawals (net payout = amount − fee).",
          },
          create: {
            key: WITHDRAWAL_FEE_USD_KEY,
            value: { amount: withdrawalFeeUsd },
            description:
              "Fixed USD fee deducted from provider withdrawals (net payout = amount − fee).",
          },
        }),
      ]);

      return {
        success: true,
        creditPriceUsd,
        commissionPercent: input.commissionPercent,
        minWithdrawalUsd,
        withdrawalFeeUsd,
      };
    }),

  getPaymentSettings: financeManagerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/settings/payment",
        tags: ["admin"],
        summary: "Get manual payment instructions (bank + InstaPay)",
      },
    })
    .input(z.void())
    .output(
      z.object({
        bankName: z.string(),
        accountName: z.string(),
        iban: z.string(),
        swiftCode: z.string(),
        currency: z.string(),
        note: z.string(),
        instapayEnabled: z.boolean(),
        instapayLink: z.string(),
      })
    )
    .query(async ({ ctx }) => loadPaymentSettings(ctx.db)),

  setPaymentSettings: financeManagerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/settings/payment",
        tags: ["admin"],
        summary: "Update manual payment instructions (bank + InstaPay)",
      },
    })
    .input(
      z.object({
        bankName: z.string().min(1),
        accountName: z.string().min(1),
        iban: z.string().min(1),
        swiftCode: z.string().min(1),
        currency: z.string().min(1),
        note: z.string().min(1),
        instapayEnabled: z.boolean(),
        instapayLink: z
          .string()
          .refine(
            (value) => value.trim() === "" || /^https?:\/\//i.test(value.trim()),
            "InstaPay link must be a valid URL"
          ),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        settings: z.object({
          bankName: z.string(),
          accountName: z.string(),
          iban: z.string(),
          swiftCode: z.string(),
          currency: z.string(),
          note: z.string(),
          instapayEnabled: z.boolean(),
          instapayLink: z.string(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings: ManualPaymentSettings = {
        bankName: input.bankName.trim(),
        accountName: input.accountName.trim(),
        iban: input.iban.trim(),
        swiftCode: input.swiftCode.trim(),
        currency: input.currency.trim().toUpperCase(),
        note: input.note.trim(),
        instapayEnabled: input.instapayEnabled,
        instapayLink: input.instapayLink.trim(),
      };

      if (settings.instapayEnabled && !settings.instapayLink) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "InstaPay link is required when InstaPay is enabled",
        });
      }

      await ctx.db.systemSettings.upsert({
        where: { key: PAYMENT_INSTRUCTIONS_KEY },
        update: {
          value: settings,
          description: "Manual client payment instructions (bank transfer + InstaPay).",
        },
        create: {
          key: PAYMENT_INSTRUCTIONS_KEY,
          value: settings,
          description: "Manual client payment instructions (bank transfer + InstaPay).",
        },
      });

      return { success: true, settings };
    }),

  // Get all active service types (public - for landing page)
  getPublicServiceTypes: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/services/public",
        tags: ["admin"],
        summary: "List all active service types",
      },
    })
    .input(z.void())
    .output(z.array(z.any()))
    .query(async ({ ctx }) => {
      return ctx.db.serviceType.findMany({
        where: { isActive: true, deletedAt: null },
        select: {
          id: true,
          name: true,
          nameI18n: true,
          description: true,
          descriptionI18n: true,
          icon: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      });
    }),

  // Get all active packages (public - for landing page)
  getPublicPackages: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/packages/public",
        tags: ["admin"],
        summary: "List all active packages",
      },
    })
    .input(z.void())
    .output(z.array(z.any()))
    .query(async () => {
      const { getPublicPackages } = await import("@/lib/public-packages");
      return getPublicPackages();
    }),

  // Get dashboard stats
  getStats: adminProcedure
    .meta({
      openapi: { method: "GET", path: "/admin/stats", tags: ["admin"], summary: "Get admin stats" },
    })
    .input(z.void())
    .output(
      z.object({
        totalUsers: z.number(),
        clients: z.number(),
        providers: z.number(),
        totalRequests: z.number(),
        activeRequests: z.number(),
        pendingRequests: z.number(),
        completedRequests: z.number(),
        activeSubscriptions: z.number(),
        serviceTypes: z.number(),
        averageRating: z.number().nullable().optional(),
        totalRevenue: z.number(),
      })
    )
    .query(async ({ ctx }) => {
      const ACTIVE_STATUSES = ["PENDING", "IN_PROGRESS", "REVISION_REQUESTED"] as const;

      const [
        userRoles,
        requestStatuses,
        activeSubscriptions,
        serviceTypes,
        avgRating,
        revenueData,
      ] = await Promise.all([
        ctx.db.user.groupBy({ by: ["role"], _count: { id: true } }),
        ctx.db.request.groupBy({ by: ["status"], _count: { id: true } }),
        ctx.db.clientSubscription.count({
          where: { isActive: true, endDate: { gte: new Date() } },
        }),
        ctx.db.serviceType.count({ where: { isActive: true } }),
        ctx.db.rating.aggregate({ _avg: { rating: true } }),
        ctx.db.$queryRaw<[{ total: number }]>`
            SELECT COALESCE(SUM(p.price), 0) as total
            FROM "ClientSubscription" cs
            JOIN "Package" p ON cs."packageId" = p.id
            WHERE cs."isActive" = true
          `,
      ]);

      const roleCount = (role: string) => userRoles.find((r) => r.role === role)?._count.id ?? 0;
      const statusCount = (status: string) =>
        requestStatuses.find((r) => r.status === status)?._count.id ?? 0;
      const totalUsers = userRoles.reduce((sum, r) => sum + r._count.id, 0);
      const totalRequests = requestStatuses.reduce((sum, r) => sum + r._count.id, 0);
      const activeRequests = ACTIVE_STATUSES.reduce((sum, s) => sum + statusCount(s), 0);

      return {
        totalUsers,
        clients: roleCount("CLIENT"),
        providers: roleCount("PROVIDER"),
        totalRequests,
        activeRequests,
        pendingRequests: statusCount("PENDING"),
        completedRequests: statusCount("COMPLETED"),
        activeSubscriptions,
        serviceTypes,
        averageRating: avgRating._avg.rating,
        totalRevenue: Number(revenueData[0]?.total ?? 0),
      };
    }),

  // Get analytics data for charts
  getAnalytics: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/analytics",
        tags: ["admin"],
        summary: "Get analytics data",
      },
    })
    .input(z.void())
    .output(z.any())
    .query(async ({ ctx }) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Batch all independent queries in parallel for maximum performance
      const [
        requestsByStatus,
        subscriptionsByPackage,
        requestsByService,
        serviceTypes,
        recentUsers,
        recentRequests,
        monthlyRevenueRows,
        topProviders,
      ] = await Promise.all([
        // Get requests by status for pie chart
        ctx.db.request.groupBy({
          by: ["status"],
          _count: { id: true },
        }),
        // Get subscriptions by package - use groupBy for efficiency
        ctx.db.clientSubscription.groupBy({
          by: ["packageId"],
          where: { isActive: true },
          _count: { id: true },
        }),
        // Get requests by service type
        ctx.db.request.groupBy({
          by: ["serviceTypeId"],
          _count: { id: true },
        }),
        // Get all service types for mapping
        ctx.db.serviceType.findMany({
          select: { id: true, name: true },
        }),
        // Get recent users (last 30 days)
        ctx.db.user.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        // Get recent requests (last 30 days)
        ctx.db.request.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        // Monthly revenue trend (last 6 months) — aggregate in SQL
        ctx.db.$queryRaw<{ month: Date; revenue: number }[]>`
          SELECT date_trunc('month', cs."createdAt") AS month,
                 COALESCE(SUM(p.price), 0) AS revenue
          FROM "ClientSubscription" cs
          JOIN "Package" p ON cs."packageId" = p.id
          WHERE cs."createdAt" >= ${sixMonthsAgo}
          GROUP BY 1
          ORDER BY 1
        `,
        // Get top providers by completed requests
        ctx.db.request.groupBy({
          by: ["providerId"],
          where: {
            status: "COMPLETED",
            providerId: { not: null },
          },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 5,
        }),
      ]);

      // Build service map for lookups - O(n) once
      const serviceMap = new Map(serviceTypes.map((s) => [s.id, s.name]));

      // Fetch packages for subscription count mapping
      const packageIds = subscriptionsByPackage.map((s) => s.packageId);
      const packages =
        packageIds.length > 0
          ? await ctx.db.package.findMany({
              where: { id: { in: packageIds } },
              select: { id: true, name: true },
            })
          : [];
      const packageMap = new Map(packages.map((p) => [p.id, p.name]));

      const packageCounts = subscriptionsByPackage.map((s) => ({
        name: packageMap.get(s.packageId) || "Unknown",
        count: s._count.id,
      }));

      // Build monthly revenue using SQL aggregates
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const revenueByKey = new Map(
        monthlyRevenueRows.map((row) => {
          const d = new Date(row.month);
          return [`${d.getFullYear()}-${d.getMonth()}`, Number(row.revenue)];
        })
      );
      const monthlyRevenue: { month: string; revenue: number }[] = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const targetMonth = date.getMonth();
        const targetYear = date.getFullYear();
        monthlyRevenue.push({
          month: months[targetMonth],
          revenue: revenueByKey.get(`${targetYear}-${targetMonth}`) ?? 0,
        });
      }

      // Fetch provider info for top providers - O(1) lookup with Map
      const providerIds = topProviders
        .map((p: { providerId: string | null }) => p.providerId)
        .filter((id): id is string => id !== null);

      const providers =
        providerIds.length > 0
          ? await ctx.db.user.findMany({
              where: { id: { in: providerIds } },
              select: { id: true, name: true, email: true },
            })
          : [];

      const providerMap = new Map(providers.map((p) => [p.id, p]));

      const topProvidersWithInfo = topProviders.map(
        (p: { providerId: string | null; _count: { id: number } }) => {
          const provider = p.providerId ? providerMap.get(p.providerId) : null;
          return {
            name: provider?.name || provider?.email || "Unknown",
            completedRequests: p._count.id,
          };
        }
      );

      return {
        requestsByStatus: requestsByStatus.map((r: { status: string; _count: { id: number } }) => ({
          status: r.status,
          count: r._count.id,
        })),
        subscriptionsByPackage: packageCounts,
        requestsByService: requestsByService.map(
          (r: { serviceTypeId: string; _count: { id: number } }) => ({
            service: serviceMap.get(r.serviceTypeId) || "Unknown",
            count: r._count.id,
          })
        ),
        recentUsers,
        recentRequests,
        monthlyRevenue,
        topProviders: topProvidersWithInfo,
      };
    }),

  // Get all subscriptions with user info
  getAllSubscriptions: financeManagerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/subscriptions",
        tags: ["admin"],
        summary: "List subscriptions with user info",
      },
    })
    .input(
      z
        .object({
          status: z.enum(["active", "expired", "cancelled", "all"]).optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().default(0),
        })
        .optional()
    )
    .output(z.object({ subscriptions: z.array(z.any()), total: z.number(), hasMore: z.boolean() }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.ClientSubscriptionWhereInput = {};

      if (input?.status === "active") {
        where.isActive = true;
        where.endDate = { gte: new Date() };
      } else if (input?.status === "expired") {
        where.endDate = { lt: new Date() };
      } else if (input?.status === "cancelled") {
        where.cancelledAt = { not: null };
      }

      const [subscriptions, total] = await Promise.all([
        ctx.db.clientSubscription.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true, createdAt: true } },
            package: true,
          },
          take: input?.limit || 50,
          skip: input?.offset || 0,
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.clientSubscription.count({ where }),
      ]);

      return {
        subscriptions,
        total,
        hasMore: (input?.offset || 0) + subscriptions.length < total,
      };
    }),

  // Get dashboard stats (optimized - reuses getStats logic with additional recent requests)
  getDashboardStats: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/dashboard",
        tags: ["admin"],
        summary: "Get dashboard stats",
      },
    })
    .input(z.void())
    .output(z.any())
    .query(async ({ ctx }) => {
      // Run all queries in parallel for maximum efficiency
      const [
        totalUsers,
        totalClients,
        totalProviders,
        totalRequests,
        pendingRequests,
        completedRequests,
        activeSubscriptions,
        revenueData,
        recentRequests,
      ] = await Promise.all([
        ctx.db.user.count(),
        ctx.db.user.count({ where: { role: "CLIENT" } }),
        ctx.db.user.count({ where: { role: "PROVIDER" } }),
        ctx.db.request.count(),
        ctx.db.request.count({ where: { status: "PENDING" } }),
        ctx.db.request.count({ where: { status: "COMPLETED" } }),
        ctx.db.clientSubscription.count({
          where: { isActive: true, endDate: { gte: new Date() } },
        }),
        // Efficient revenue calculation using aggregate
        ctx.db.$queryRaw<[{ total: number }]>`
        SELECT COALESCE(SUM(p.price), 0) as total
        FROM "ClientSubscription" cs
        JOIN "Package" p ON cs."packageId" = p.id
        WHERE cs."isActive" = true
      `,
        ctx.db.request.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            client: { select: { name: true, email: true } },
            provider: { select: { name: true, email: true } },
            serviceType: true,
          },
        }),
      ]);

      const revenue = Number(revenueData[0]?.total ?? 0);

      return {
        totalUsers,
        totalClients,
        totalProviders,
        totalRequests,
        pendingRequests,
        completedRequests,
        activeSubscriptions,
        totalRevenue: revenue,
        recentRequests,
      };
    }),

  // Provider wallet and platform finance overview in credits/tokens.
  getFinanceOverview: financeManagerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/finance/overview",
        tags: ["admin"],
        summary: "Get provider wallet finance overview",
      },
    })
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .output(z.any())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const [
        ledgerTotals,
        walletTotals,
        providers,
        unsettledCompletedRequests,
        pendingWithdrawals,
        financeSettings,
        providerCount,
      ] = await Promise.all([
        ctx.db.providerFinanceLedger.aggregate({
          _sum: {
            totalCredits: true,
            providerCredits: true,
            platformCredits: true,
            totalAmountUsd: true,
            providerAmountUsd: true,
            platformAmountUsd: true,
          },
          _count: true,
        }),
        ctx.db.providerWallet.aggregate({
          _sum: {
            balanceCredits: true,
            heldCredits: true,
            pendingCredits: true,
            paidCredits: true,
            balanceUsd: true,
            heldUsd: true,
            pendingUsd: true,
            paidUsd: true,
          },
        }),
        ctx.db.user.findMany({
          where: {
            role: "PROVIDER",
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            providerWallet: true,
            providerProfile: {
              select: {
                payoutMethod: true,
                accountHolder: true,
                bankName: true,
                bankAccount: true,
                eWalletNumber: true,
              },
            },
            _count: {
              select: {
                providerRequests: true,
                providerFinance: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit + 1,
          ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        }),
        ctx.db.request.count({
          where: {
            status: "COMPLETED",
            providerId: { not: null },
            providerFinance: null,
          },
        }),
        ctx.db.withdrawalRequest.count({
          where: { status: "PENDING" },
        }),
        loadFinanceSettings(ctx.db),
        ctx.db.user.count({
          where: { role: "PROVIDER", deletedAt: null },
        }),
      ]);

      let nextCursor: string | null = null;
      const page = providers.length > limit ? providers.slice(0, limit) : providers;
      if (providers.length > limit) {
        nextCursor = page.at(-1)?.id ?? null;
      }

      const providerWallets = page.map((provider) => ({
        provider: {
          id: provider.id,
          name: provider.name,
          email: provider.email,
          image: provider.image,
        },
        balanceCredits: provider.providerWallet?.balanceCredits ?? 0,
        heldCredits: provider.providerWallet?.heldCredits ?? 0,
        pendingCredits: provider.providerWallet?.pendingCredits ?? 0,
        paidCredits: provider.providerWallet?.paidCredits ?? 0,
        balanceUsd: provider.providerWallet?.balanceUsd ?? 0,
        heldUsd: provider.providerWallet?.heldUsd ?? 0,
        pendingUsd: provider.providerWallet?.pendingUsd ?? 0,
        paidUsd: provider.providerWallet?.paidUsd ?? 0,
        requestCount: provider._count.providerRequests,
        ledgerCount: provider._count.providerFinance,
        payout: provider.providerProfile
          ? {
              payoutMethod: provider.providerProfile.payoutMethod,
              accountHolder: provider.providerProfile.accountHolder,
              bankName: provider.providerProfile.bankName,
              bankAccount: provider.providerProfile.bankAccount,
              eWalletNumber: provider.providerProfile.eWalletNumber,
            }
          : null,
      }));

      return {
        summary: {
          totalSettledRequests: ledgerTotals._count,
          totalRequestCredits: ledgerTotals._sum.totalCredits ?? 0,
          totalProviderCredits: ledgerTotals._sum.providerCredits ?? 0,
          totalPlatformCredits: ledgerTotals._sum.platformCredits ?? 0,
          totalRequestAmountUsd: ledgerTotals._sum.totalAmountUsd ?? 0,
          totalProviderAmountUsd: ledgerTotals._sum.providerAmountUsd ?? 0,
          totalPlatformAmountUsd: ledgerTotals._sum.platformAmountUsd ?? 0,
          totalWalletBalanceCredits: walletTotals._sum.balanceCredits ?? 0,
          totalHeldCredits: walletTotals._sum.heldCredits ?? 0,
          totalPendingCredits: walletTotals._sum.pendingCredits ?? 0,
          totalPaidCredits: walletTotals._sum.paidCredits ?? 0,
          totalWalletBalanceUsd: walletTotals._sum.balanceUsd ?? 0,
          totalHeldUsd: walletTotals._sum.heldUsd ?? 0,
          totalPendingUsd: walletTotals._sum.pendingUsd ?? 0,
          totalPaidUsd: walletTotals._sum.paidUsd ?? 0,
          unsettledCompletedRequests,
          pendingWithdrawals,
          creditPriceUsd: financeSettings.creditPriceUsd,
          commissionPercent: financeSettings.commissionPercent,
          providerCount,
        },
        providerWallets,
        nextCursor,
      };
    }),

  getProviderFinanceLedger: financeManagerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/finance/ledger",
        tags: ["admin"],
        summary: "Get provider finance ledger entries",
      },
    })
    .input(
      z
        .object({
          providerId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .output(z.any())
    .query(async ({ ctx, input }) => {
      const where = input?.providerId ? { providerId: input.providerId } : {};

      const ledger = await ctx.db.providerFinanceLedger.findMany({
        where,
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          request: {
            select: {
              id: true,
              title: true,
              status: true,
              creditCost: true,
              completedAt: true,
              client: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
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
        take: input?.limit ?? 50,
      });

      return { ledger };
    }),

  getWithdrawals: financeManagerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/finance/withdrawals",
        tags: ["admin"],
        summary: "List provider withdrawal requests",
      },
    })
    .input(
      z
        .object({
          status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
          providerId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .output(z.any())
    .query(async ({ ctx, input }) => {
      const withdrawals = await ctx.db.withdrawalRequest.findMany({
        where: {
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.providerId ? { providerId: input.providerId } : {}),
        },
        include: {
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: input?.limit ?? 50,
      });

      return { withdrawals };
    }),

  reviewWithdrawal: financeManagerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/finance/withdrawals/review",
        tags: ["admin"],
        summary: "Approve or reject a provider withdrawal",
      },
    })
    .input(
      z.object({
        withdrawalId: z.string(),
        status: z.enum(["APPROVED", "REJECTED"]),
        reason: z.string().min(1),
        reviewImage: z.string().min(1),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        assertAllowedUploadUrls([input.reviewImage], ctx.session.user.id);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid review image. Upload the image through the app first.",
        });
      }

      const withdrawal = await ctx.db.$transaction((tx) =>
        reviewProviderWithdrawal(tx, {
          withdrawalId: input.withdrawalId,
          adminId: ctx.session.user.id,
          status: input.status,
          reason: input.reason,
          reviewImage: input.reviewImage,
        })
      );

      await notifyProviderWithdrawalReviewed({
        providerId: withdrawal.providerId,
        status: input.status,
        amountUsd: withdrawal.amountUsd,
        reason: input.reason.trim(),
        locale: ctx.locale,
      });

      logActivityAsync({
        action: "wallet.withdraw_review",
        message: `Withdrawal ${input.status.toLowerCase()}: ${withdrawal.amountUsd} USD`,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        entityType: "WithdrawalRequest",
        entityId: withdrawal.id,
        metadata: {
          status: input.status,
          amountUsd: withdrawal.amountUsd,
          providerId: withdrawal.providerId,
          reason: input.reason.trim(),
          reviewImage: input.reviewImage,
        },
      });

      return { success: true };
    }),

  getFinanceDisputes: financeManagerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/finance/disputes",
        tags: ["admin"],
        summary: "List provider finance disputes",
      },
    })
    .input(
      z
        .object({
          status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED", "ALL"]).optional(),
          limit: z.number().min(1).max(100).optional(),
        })
        .optional()
    )
    .output(z.object({ disputes: z.array(z.any()) }))
    .query(async ({ ctx, input }) => {
      const status = input?.status && input.status !== "ALL" ? input.status : undefined;
      const disputes = await ctx.db.providerFinanceDispute.findMany({
        where: status ? { status } : undefined,
        include: {
          provider: {
            select: { id: true, name: true, email: true },
          },
          ledger: {
            select: {
              id: true,
              providerAmountUsd: true,
              providerCredits: true,
              status: true,
              request: { select: { id: true, title: true } },
            },
          },
          withdrawal: {
            select: {
              id: true,
              amountUsd: true,
              amountCredits: true,
              status: true,
            },
          },
          reviewedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: input?.limit ?? 50,
      });

      return { disputes };
    }),

  reviewFinanceDispute: financeManagerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/finance/disputes/review",
        tags: ["admin"],
        summary: "Update a provider finance dispute",
      },
    })
    .input(
      z.object({
        disputeId: z.string(),
        status: z.enum(["UNDER_REVIEW", "RESOLVED", "REJECTED"]),
        adminNote: z.string().min(1),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const dispute = await ctx.db.$transaction((tx) =>
        reviewProviderFinanceDispute(tx, {
          disputeId: input.disputeId,
          adminId: ctx.session.user.id,
          status: input.status,
          adminNote: input.adminNote,
        })
      );

      await notifyProviderFinanceDisputeReviewed({
        providerId: dispute.providerId,
        status: input.status,
        note: input.adminNote.trim(),
        locale: ctx.locale,
      });

      logActivityAsync({
        action: "wallet.dispute_review",
        message: `Finance dispute ${input.status.toLowerCase()}`,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        entityType: "ProviderFinanceDispute",
        entityId: dispute.id,
        metadata: {
          status: input.status,
          providerId: dispute.providerId,
          ledgerId: dispute.ledgerId,
          withdrawalId: dispute.withdrawalId,
        },
      });

      return { success: true };
    }),

  sendProviderPayout: financeManagerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/finance/payouts",
        tags: ["admin"],
        summary: "Send a manual payout to a provider",
      },
    })
    .input(
      z.object({
        providerId: z.string(),
        amountUsd: z.number().positive(),
        reason: z.string().min(1),
      })
    )
    .output(z.object({ success: z.boolean(), withdrawalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const withdrawal = await ctx.db.$transaction((tx) =>
        sendProviderPayout(tx, {
          providerId: input.providerId,
          adminId: ctx.session.user.id,
          amountUsd: input.amountUsd,
          reason: input.reason,
        })
      );

      await notifyProviderWithdrawalReviewed({
        providerId: withdrawal.providerId,
        status: "APPROVED",
        amountUsd: withdrawal.amountUsd,
        reason: input.reason.trim(),
        locale: ctx.locale,
      });

      logActivityAsync({
        action: "wallet.payout",
        message: `Admin payout ${withdrawal.amountUsd} USD to creator`,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        entityType: "WithdrawalRequest",
        entityId: withdrawal.id,
        metadata: {
          amountUsd: withdrawal.amountUsd,
          providerId: input.providerId,
          reason: input.reason.trim(),
        },
      });

      return { success: true, withdrawalId: withdrawal.id };
    }),

  /**
   * Repair path: settle COMPLETED requests that never got a finance ledger
   * entry (e.g. completed before wallet feature, or failed settlement).
   */
  settleUnsettledCompletedRequests: financeManagerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/finance/settle-unsettled",
        tags: ["admin"],
        summary: "Settle completed requests missing finance ledger entries",
      },
    })
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .output(
      z.object({
        settled: z.number(),
        skipped: z.number(),
        errors: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const unsettled = await ctx.db.request.findMany({
        where: {
          status: "COMPLETED",
          providerId: { not: null },
          deletedAt: null,
          providerFinance: null,
        },
        select: { id: true },
        take: input?.limit ?? 50,
        orderBy: { completedAt: "asc" },
      });

      let settled = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const request of unsettled) {
        try {
          await ctx.db.$transaction(async (tx) => {
            await settleCompletedRequest(tx, request.id);
          });
          settled += 1;
        } catch (err) {
          skipped += 1;
          errors.push(`${request.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      logActivityAsync({
        action: "wallet.settle",
        message: `Settled ${settled} unsettled request(s); skipped ${skipped}`,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        metadata: { settled, skipped, errors: errors.slice(0, 10) },
      });

      return { settled, skipped, errors };
    }),

  getActivityLogs: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/activity-logs",
        tags: ["admin"],
        summary: "List system activity / audit history",
      },
    })
    .input(
      z
        .object({
          action: z.string().optional(),
          level: z.enum(["info", "warn", "error"]).optional(),
          actorId: z.string().optional(),
          entityType: z.string().optional(),
          entityId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .output(
      z.object({
        logs: z.array(z.any()),
        nextCursor: z.string().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: {
        action?: string | { startsWith: string };
        level?: string;
        actorId?: string;
        entityType?: string;
        entityId?: string;
      } = {};
      if (input?.action) {
        // Allow prefix filters like "request." to show full request history
        where.action = input.action.endsWith(".") ? { startsWith: input.action } : input.action;
      }
      if (input?.level) where.level = input.level;
      if (input?.actorId) where.actorId = input.actorId;
      if (input?.entityType) where.entityType = input.entityType;
      if (input?.entityId) where.entityId = input.entityId;

      const logs = await ctx.db.activityLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: (input?.limit ?? 50) + 1,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        skip: input?.cursor ? 1 : 0,
      });

      let nextCursor: string | null = null;
      if (logs.length > (input?.limit ?? 50)) {
        const next = logs.pop();
        nextCursor = next?.id ?? null;
      }

      return { logs, nextCursor };
    }),

  // Contact-leak security events for request managers / super admins
  getContactLeakEvents: requestManagerProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/contact-leaks",
        tags: ["admin"],
        summary: "List blocked off-platform contact attempts",
      },
    })
    .input(
      z
        .object({
          filter: z.enum(["all", "blocked", "rate_limited"]).default("all"),
          actorId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .output(
      z.object({
        stats: z.object({
          blockedLast24h: z.number(),
          rateLimitedLast24h: z.number(),
          uniqueActorsLast7d: z.number(),
          totalLast7d: z.number(),
        }),
        events: z.array(z.any()),
        strikeStates: z.record(
          z.string(),
          z.object({
            count: z.number(),
            remaining: z.number(),
            resetAt: z.number(),
            blocked: z.boolean(),
          })
        ),
        nextCursor: z.string().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const filter = input?.filter ?? "all";
      const limit = input?.limit ?? 50;
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const actionFilter =
        filter === "blocked"
          ? "security.contact_leak"
          : filter === "rate_limited"
            ? "security.contact_leak_rate_limited"
            : { startsWith: "security.contact_leak" };

      const where = {
        action: actionFilter,
        ...(input?.actorId ? { actorId: input.actorId } : {}),
      };

      const [blockedLast24h, rateLimitedLast24h, totalLast7d, uniqueActorRows, events] =
        await Promise.all([
          ctx.db.activityLog.count({
            where: {
              action: "security.contact_leak",
              createdAt: { gte: dayAgo },
            },
          }),
          ctx.db.activityLog.count({
            where: {
              action: "security.contact_leak_rate_limited",
              createdAt: { gte: dayAgo },
            },
          }),
          ctx.db.activityLog.count({
            where: {
              action: { startsWith: "security.contact_leak" },
              createdAt: { gte: weekAgo },
            },
          }),
          ctx.db.activityLog.findMany({
            where: {
              action: { startsWith: "security.contact_leak" },
              createdAt: { gte: weekAgo },
              actorId: { not: null },
            },
            select: { actorId: true },
            distinct: ["actorId"],
          }),
          ctx.db.activityLog.findMany({
            where,
            include: {
              actor: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            cursor: input?.cursor ? { id: input.cursor } : undefined,
            skip: input?.cursor ? 1 : 0,
          }),
        ]);

      let nextCursor: string | null = null;
      if (events.length > limit) {
        const next = events.pop();
        nextCursor = next?.id ?? null;
      }

      const actorIds = new Set<string>();
      for (const row of uniqueActorRows) {
        if (row.actorId) actorIds.add(row.actorId);
      }
      for (const row of events) {
        if (row.actorId) actorIds.add(row.actorId);
      }

      const strikeStates: Record<
        string,
        { count: number; remaining: number; resetAt: number; blocked: boolean }
      > = {};
      for (const actorId of actorIds) {
        const state = getContactLeakStrikeState(actorId);
        if (state) strikeStates[actorId] = state;
      }

      return {
        stats: {
          blockedLast24h,
          rateLimitedLast24h,
          uniqueActorsLast7d: uniqueActorRows.length,
          totalLast7d,
        },
        events,
        strikeStates,
        nextCursor,
      };
    }),

  clearContactLeakStrikes: requestManagerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/contact-leaks/clear-strikes",
        tags: ["admin"],
        summary: "Clear contact-leak strikes / lockout for a user",
      },
    })
    .input(
      z.object({
        userId: z.string().min(1),
        reason: z.string().max(500).optional(),
      })
    )
    .output(
      z.object({
        cleared: z.boolean(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirst({
        where: { id: input.userId, deletedAt: null },
        select: { id: true, email: true, name: true, role: true },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const cleared = clearContactLeakStrikesForUser(user.id);

      logActivityAsync({
        action: "security.contact_leak_cleared",
        level: "info",
        message: cleared
          ? `Cleared contact-leak strikes for ${user.email}`
          : `No active contact-leak strikes for ${user.email}`,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        entityType: "User",
        entityId: user.id,
        metadata: {
          targetUserId: user.id,
          targetEmail: user.email,
          targetRole: user.role,
          cleared,
          reason: input.reason?.trim() || null,
        },
      });

      return { cleared, userId: user.id };
    }),

  // Get all users
  getUsers: adminProcedure
    .meta({
      openapi: { method: "GET", path: "/admin/users", tags: ["admin"], summary: "List users" },
    })
    .input(
      z
        .object({
          role: z.enum(ALL_ROLES).optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().default(0),
          search: z.string().optional(),
          status: z
            .enum(["all", "active", "inactive", "pending", "rejected", "approved"])
            .optional(),
        })
        .optional()
    )
    .output(z.object({ users: z.array(z.any()), total: z.number() }))
    .query(async ({ ctx, input }) => {
      const where: any = {};

      if (input?.role) {
        where.role = input.role;
      }

      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }

      // Filter by lifecycle: active = approved + not soft-deleted
      const status = input?.status ?? "active";
      if (status === "active" || status === "approved") {
        where.deletedAt = null;
        where.approvalStatus = "APPROVED";
      } else if (status === "pending") {
        where.deletedAt = null;
        where.approvalStatus = "PENDING";
      } else if (status === "rejected") {
        where.deletedAt = null;
        where.approvalStatus = "REJECTED";
      } else if (status === "inactive") {
        where.deletedAt = { not: null };
      }

      const [users, total, ratingAvgs] = await Promise.all([
        ctx.db.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
            role: true,
            approvalStatus: true,
            approvedAt: true,
            rejectedAt: true,
            rejectionReason: true,
            createdAt: true,
            deletedAt: true,
            providerProfile: {
              select: {
                id: true,
                bio: true,
                portfolio: true,
                cvUrl: true,
                skillsTags: true,
                supportedServices: {
                  select: { id: true, name: true, nameI18n: true },
                },
              },
            },
            _count: {
              select: {
                clientRequests: true,
                providerRequests: true,
                clientSubscriptions: true,
                receivedRatings: true,
              },
            },
          },
          take: input?.limit || 50,
          skip: input?.offset || 0,
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.user.count({ where }),
        ctx.db.rating.groupBy({
          by: ["providerId"],
          _avg: { rating: true },
        }),
      ]);

      const avgByProvider = new Map(ratingAvgs.map((row) => [row.providerId, row._avg.rating]));

      const usersWithRating = users.map((user) => ({
        ...user,
        averageRating: avgByProvider.get(user.id) ?? null,
      }));

      return {
        users: usersWithRating,
        total,
        hasMore: (input?.offset || 0) + users.length < total,
      };
    }),

  // Get all requests
  getAllRequests: requestManagerProcedure
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
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.RequestWhereInput = {
        deletedAt: null,
      };

      if (input?.status) {
        where.status = input.status;
      }

      const [requests, total] = await Promise.all([
        ctx.db.request.findMany({
          where,
          include: {
            client: { select: { id: true, name: true, email: true } },
            provider: { select: { id: true, name: true, email: true } },
            serviceType: true,
          },
          take: input?.limit || 50,
          skip: input?.offset || 0,
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.request.count({ where }),
      ]);

      // Use stored credit cost from database
      return {
        requests,
        total,
        hasMore: (input?.offset || 0) + requests.length < total,
      };
    }),

  // Create service type
  createServiceType: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        nameI18n: z.record(z.string()).optional(),
        descriptionI18n: z.record(z.string()).optional(),
        icon: z.string().optional(),
        formFields: z.any().optional(),
        attributes: z.any().optional(), // Q&A attributes: [{question: string, required: boolean, type: string, options?: string[]}]
        creditCost: z.number().min(1).default(1), // Number of credits required for this service
        maxFreeRevisions: z.number().min(0).default(3), // Number of free revisions per request
        paidRevisionCost: z.number().min(1).default(1), // Cost in credits for paid revisions
        resetFreeRevisionsOnPaid: z.boolean().default(true), // Reset free revision counter after paid revision
        maxDeliveryMinutes: z.number().min(15).default(480), // Max estimated delivery time in minutes
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.serviceType.findUnique({
        where: { name: input.name },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A service type with this name already exists",
        });
      }

      const maxSort = await ctx.db.serviceType.aggregate({
        _max: { sortOrder: true },
      });
      const nextSortOrder = input.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1;

      const serviceType = await ctx.db.serviceType.create({
        data: {
          name: input.name,
          description: input.description,
          nameI18n: input.nameI18n || null,
          descriptionI18n: input.descriptionI18n || null,
          icon: input.icon,
          formFields: input.formFields,
          attributes: input.attributes,
          creditCost: input.creditCost,
          maxFreeRevisions: input.maxFreeRevisions,
          paidRevisionCost: input.paidRevisionCost,
          resetFreeRevisionsOnPaid: input.resetFreeRevisionsOnPaid,
          maxDeliveryMinutes: input.maxDeliveryMinutes,
          sortOrder: nextSortOrder,
        } as any,
      });

      await invalidateServiceTypesCache();

      return {
        success: true,
        serviceType,
      };
    }),

  // Update service type
  updateServiceType: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        nameI18n: z.record(z.string()).optional(),
        descriptionI18n: z.record(z.string()).optional(),
        icon: z.string().optional(),
        formFields: z.any().optional(),
        attributes: z.any().optional(), // Q&A attributes: [{question: string, required: boolean, type: string, options?: string[]}]
        creditCost: z.number().min(1).optional(), // Number of credits required for this service
        maxFreeRevisions: z.number().min(0).optional(), // Number of free revisions per request
        paidRevisionCost: z.number().min(1).optional(), // Cost in credits for paid revisions
        resetFreeRevisionsOnPaid: z.boolean().optional(), // Reset free revision counter after paid revision
        maxDeliveryMinutes: z.number().min(15).optional(), // Max estimated delivery time in minutes
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const serviceType = await ctx.db.serviceType.update({
        where: { id },
        data: {
          ...data,
          ...(input.nameI18n !== undefined && { nameI18n: input.nameI18n as any }),
          ...(input.descriptionI18n !== undefined && {
            descriptionI18n: input.descriptionI18n as any,
          }),
        },
      });

      await invalidateServiceTypeCache(id);

      return {
        success: true,
        serviceType,
      };
    }),

  // Set service type active / inactive
  setServiceTypeActive: adminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const serviceType = await ctx.db.serviceType.findUnique({
        where: { id: input.id },
      });

      if (!serviceType) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Service type not found",
        });
      }

      await ctx.db.serviceType.update({
        where: { id: input.id },
        data: {
          isActive: input.isActive,
          ...(input.isActive ? { deletedAt: null } : {}),
        },
      });

      await invalidateServiceTypeCache(input.id);

      return {
        success: true,
        message: `Service type "${serviceType.name}" has been ${input.isActive ? "activated" : "deactivated"}`,
      };
    }),

  // Reorder service type within the current filter; keeps create-request order in sync
  reorderServiceType: adminProcedure
    .input(
      z.object({
        id: z.string(),
        direction: z.enum(["up", "down"]),
        status: z.enum(["all", "active", "inactive"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const status = input.status ?? "all";

      const allServices = await ctx.db.serviceType.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, isActive: true },
      });

      const matchesFilter = (service: { isActive: boolean }) => {
        if (status === "active") return service.isActive;
        if (status === "inactive") return !service.isActive;
        return true;
      };

      const filtered = allServices.filter(matchesFilter);
      const filteredIndex = filtered.findIndex((s) => s.id === input.id);
      if (filteredIndex === -1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Service type not found",
        });
      }

      const swapFilteredIndex = input.direction === "up" ? filteredIndex - 1 : filteredIndex + 1;
      if (swapFilteredIndex < 0 || swapFilteredIndex >= filtered.length) {
        return { success: true, message: "Already at edge" };
      }

      const currentId = filtered[filteredIndex]!.id;
      const neighborId = filtered[swapFilteredIndex]!.id;
      const currentGlobalIndex = allServices.findIndex((s) => s.id === currentId);
      const neighborGlobalIndex = allServices.findIndex((s) => s.id === neighborId);

      const reordered = [...allServices];
      const tmp = reordered[currentGlobalIndex]!;
      reordered[currentGlobalIndex] = reordered[neighborGlobalIndex]!;
      reordered[neighborGlobalIndex] = tmp;

      await ctx.db.$transaction(
        reordered.map((service, i) =>
          ctx.db.serviceType.update({
            where: { id: service.id },
            data: { sortOrder: i },
          })
        )
      );

      await invalidateServiceTypesCache();

      return { success: true };
    }),

  // Create package
  createPackage: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        nameI18n: z.record(z.string()).optional(),
        price: z.number().min(0),
        credits: z.number().min(1),
        durationDays: z.number().min(1).default(30),
        description: z.string().optional(),
        descriptionI18n: z.record(z.string()).optional(),
        features: z.array(z.string()).default([]),
        featuresI18n: z.record(z.array(z.string())).optional(),
        supportAllServices: z.boolean().default(false),
        isFeatured: z.boolean().default(false),
        serviceIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { serviceIds, ...packageData } = input;

      // Validate service IDs exist if provided
      if (serviceIds.length > 0) {
        const validServices = await ctx.db.serviceType.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true },
        });

        if (validServices.length !== serviceIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more service IDs are invalid",
          });
        }
      }

      const pkg = await ctx.db.package.create({
        data: {
          name: packageData.name,
          nameI18n: packageData.nameI18n || null,
          description: packageData.description,
          descriptionI18n: packageData.descriptionI18n || null,
          credits: packageData.credits,
          price: packageData.price,
          durationDays: packageData.durationDays,
          features: packageData.features,
          featuresI18n: packageData.featuresI18n || null,
          supportAllServices: packageData.supportAllServices,
          isFeatured: packageData.isFeatured,
          services: {
            create: serviceIds.map((serviceId: string) => ({
              serviceId,
            })),
          },
        } as any,
        include: {
          services: {
            include: {
              serviceType: true,
            },
          },
        },
      });

      if (packageData.isFeatured) {
        await clearFeaturedExcept(ctx.db, pkg.id);
      }

      await invalidatePackageCache();

      return { success: true, package: pkg };
    }),

  // Update package
  updatePackage: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        nameI18n: z.record(z.string()).optional(),
        description: z.string().optional(),
        descriptionI18n: z.record(z.string()).optional(),
        price: z.number().min(0).optional(),
        credits: z.number().min(1).optional(),
        durationDays: z.number().min(1).optional(),
        features: z.array(z.string()).optional(),
        featuresI18n: z.record(z.array(z.string())).optional(),
        isActive: z.boolean().optional(),
        supportAllServices: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        serviceIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, serviceIds, ...data } = input;

      const existing = await ctx.db.package.findUnique({
        where: { id },
        select: { id: true, isFreePackage: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Package not found",
        });
      }

      if (existing.isFreePackage && data.isActive === false) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot deactivate the free package",
        });
      }

      // Validate service IDs exist if provided
      if (serviceIds !== undefined && serviceIds.length > 0) {
        const validServices = await ctx.db.serviceType.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true },
        });

        if (validServices.length !== serviceIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more service IDs are invalid",
          });
        }
      }

      if (input.isFeatured === true && !existing.isFreePackage) {
        await clearFeaturedExcept(ctx.db, id);
      }

      // Free plan stays $0 and is never landing "featured"
      const updateData = {
        ...data,
        ...(existing.isFreePackage
          ? {
              price: 0,
              isFeatured: false,
            }
          : {}),
      };

      // Update package and handle services if provided
      const pkg = await ctx.db.package.update({
        where: { id },
        data: {
          ...updateData,
          ...(input.nameI18n !== undefined && { nameI18n: input.nameI18n as any }),
          ...(input.descriptionI18n !== undefined && {
            descriptionI18n: input.descriptionI18n as any,
          }),
          ...(input.featuresI18n !== undefined && { featuresI18n: input.featuresI18n as any }),
          ...(serviceIds !== undefined && {
            services: {
              deleteMany: {},
              create: serviceIds.map((serviceId: string) => ({
                serviceId,
              })),
            },
          }),
        },
        include: {
          services: {
            include: {
              serviceType: true,
            },
          },
        },
      });

      await invalidatePackageCache();

      return { success: true, package: pkg };
    }),

  // Set package active / inactive
  setPackageActive: adminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.findUnique({
        where: { id: input.id },
      });

      if (!pkg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Package not found",
        });
      }

      if (pkg.isFreePackage && !input.isActive) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot deactivate the free package",
        });
      }

      await ctx.db.package.update({
        where: { id: input.id },
        data: {
          isActive: input.isActive,
          ...(input.isActive ? { deletedAt: null } : {}),
        },
      });

      await invalidatePackageCache();

      return {
        success: true,
        message: `Package "${pkg.name}" has been ${input.isActive ? "activated" : "deactivated"}`,
      };
    }),

  // Get all service types
  getServiceTypes: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["all", "active", "inactive"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "active";
      const where =
        status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {};

      return ctx.db.serviceType.findMany({
        where,
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { requests: true } },
        },
      });
    }),

  // Get all packages (admin only) — includes free trial plan for config
  getPackages: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["all", "active", "inactive"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "active";
      const where = {
        ...(status === "active"
          ? { isActive: true }
          : status === "inactive"
            ? { isActive: false }
            : {}),
      };

      return ctx.db.package.findMany({
        where,
        orderBy: [{ isFreePackage: "desc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          name: true,
          nameI18n: true,
          description: true,
          descriptionI18n: true,
          features: true,
          featuresI18n: true,
          price: true,
          credits: true,
          durationDays: true,
          sortOrder: true,
          isActive: true,
          isFeatured: true,
          isFreePackage: true,
          supportAllServices: true,
          services: {
            select: {
              serviceType: {
                select: {
                  id: true,
                  name: true,
                  nameI18n: true,
                  icon: true,
                } as any,
              },
            },
          },
        } as any,
      });
    }),

  // Update user role
  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(ASSIGNABLE_ROLES),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot change your own role",
        });
      }

      const existing = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          _count: {
            select: {
              clientRequests: true,
              providerRequests: true,
            },
          },
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (isSuperAdmin(existing.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Super admin accounts cannot be modified",
        });
      }

      const blockReason = getRoleChangeBlockReason({
        currentRole: existing.role,
        newRole: input.role,
        clientRequestCount: existing._count.clientRequests,
        providerRequestCount: existing._count.providerRequests,
      });
      if (blockReason) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: blockReason,
        });
      }

      const user = await ctx.db.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });

      await invalidateSessionUserCache(input.userId);

      if (input.role === "PROVIDER") {
        await ctx.db.providerProfile.upsert({
          where: { userId: input.userId },
          update: {},
          create: {
            userId: input.userId,
            skillsTags: [],
          },
        });
      }

      if (existing.role !== input.role) {
        await notifyRoleChanged({
          userId: existing.id,
          userName: existing.name || existing.email,
          oldRole: existing.role,
          newRole: input.role,
          locale: ctx.locale,
        });
      }

      return {
        success: true,
        user,
      };
    }),

  // Get all providers for assignment
  getProviders: requestManagerProcedure
    .input(
      z
        .object({
          serviceTypeId: z.string().optional(), // Filter providers by supported service
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const providers = await ctx.db.user.findMany({
        where: {
          role: "PROVIDER",
          ...(input?.serviceTypeId && {
            providerProfile: {
              supportedServices: {
                some: { id: input.serviceTypeId },
              },
            },
          }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          providerProfile: {
            select: {
              bio: true,
              skillsTags: true,
              supportedServices: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              providerRequests: {
                where: {
                  status: { in: ["PENDING", "IN_PROGRESS"] },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

      type ProviderWithProfile = (typeof providers)[number];

      return providers.map((p: ProviderWithProfile) => ({
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        bio: p.providerProfile?.bio || null,
        skills: p.providerProfile?.skillsTags || [],
        supportedServices: p.providerProfile?.supportedServices || [],
        activeRequests: p._count.providerRequests,
      }));
    }),

  // Approved clients for admin request creation (includes subscription/credits)
  getClientsForRequest: requestManagerProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim();
      const clients = await ctx.db.user.findMany({
        where: {
          role: "CLIENT",
          deletedAt: null,
          approvalStatus: "APPROVED",
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { email: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          clientSubscriptions: {
            where: {
              isActive: true,
              endDate: { gte: new Date() },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              remainingCredits: true,
              endDate: true,
              package: {
                select: {
                  id: true,
                  name: true,
                  nameI18n: true,
                  supportAllServices: true,
                  services: {
                    select: { serviceId: true },
                  },
                },
              },
            },
          },
        },
        take: input?.limit ?? 50,
        orderBy: { name: "asc" },
      });

      return clients.map((client) => {
        const sub = client.clientSubscriptions[0] ?? null;
        return {
          id: client.id,
          name: client.name || client.email,
          email: client.email,
          remainingCredits: sub?.remainingCredits ?? 0,
          subscriptionEndDate: sub?.endDate ?? null,
          hasActiveSubscription: Boolean(sub),
          package: sub
            ? {
                id: sub.package.id,
                name: sub.package.name,
                nameI18n: sub.package.nameI18n,
                supportAllServices: Boolean(
                  (sub.package as { supportAllServices?: boolean }).supportAllServices
                ),
                allowedServiceIds: (
                  sub.package as {
                    supportAllServices?: boolean;
                    services: { serviceId: string }[];
                  }
                ).supportAllServices
                  ? null
                  : sub.package.services.map((s) => s.serviceId),
              }
            : null,
        };
      });
    }),

  // Service types filtered by a client's package (for admin create-request UI)
  getServiceTypesForClient: requestManagerProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.db.user.findFirst({
        where: {
          id: input.clientId,
          role: "CLIENT",
          deletedAt: null,
          approvalStatus: "APPROVED",
        },
        select: { id: true },
      });

      if (!client) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found, inactive, or not approved",
        });
      }

      const activeSubscription = await ctx.db.clientSubscription.findFirst({
        where: {
          userId: input.clientId,
          isActive: true,
          endDate: { gte: new Date() },
        },
        include: {
          package: {
            select: {
              id: true,
              name: true,
              nameI18n: true,
              supportAllServices: true,
              services: {
                select: {
                  serviceType: { select: { id: true } },
                },
              },
            },
          },
        },
      });

      if (!activeSubscription) {
        return {
          remainingCredits: 0,
          package: null,
          services: [] as Array<{
            id: string;
            name: string;
            nameI18n: unknown;
            description: string | null;
            descriptionI18n: unknown;
            icon: string | null;
            attributes: unknown;
            creditCost: number;
            isActive: boolean;
            sortOrder: number;
            isSupported: boolean;
          }>,
        };
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

      const supportAllServices = Boolean(
        (activeSubscription.package as { supportAllServices?: boolean }).supportAllServices
      );
      const allowedServiceIds = supportAllServices
        ? null
        : new Set(
            activeSubscription.package.services.map(
              (ps: { serviceType: { id: string } }) => ps.serviceType.id
            )
          );

      return {
        remainingCredits: activeSubscription.remainingCredits,
        package: {
          id: activeSubscription.package.id,
          name: activeSubscription.package.name,
          nameI18n: activeSubscription.package.nameI18n,
          supportAllServices,
        },
        services: allServices.map((service) => ({
          ...service,
          isSupported: supportAllServices || allowedServiceIds?.has(service.id) || false,
        })),
      };
    }),

  // Create a request on behalf of a client (deducts the client's credits)
  createRequest: requestManagerProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/admin/request",
        tags: ["admin"],
        summary: "Create a request for a client",
      },
    })
    .input(
      z.object({
        clientId: z.string().min(1, "Client is required"),
        providerId: z.string().optional(),
        title: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required"),
        serviceTypeId: z.string().min(1, "Service type is required"),
        formData: z.record(z.any()).optional(),
        attributeResponses: z.any().optional(),
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
      const result = await createServiceRequest({
        db: ctx.db,
        clientId: input.clientId,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        locale: ctx.locale,
        title: input.title,
        description: input.description,
        serviceTypeId: input.serviceTypeId,
        formData: input.formData,
        attributeResponses: input.attributeResponses,
        attachments: input.attachments,
        providerId: input.providerId,
        uploaderUserId: ctx.session.user.id,
        createdByStaff: true,
      });

      return result;
    }),

  // Assign request to provider
  assignRequest: requestManagerProcedure
    .input(
      z.object({
        requestId: z.string(),
        providerId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the request exists
      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
        include: { provider: true },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      // Verify the provider exists and is a provider
      const provider = await ctx.db.user.findUnique({
        where: { id: input.providerId },
      });

      if (provider?.role !== "PROVIDER") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Creator not found",
        });
      }

      // Update the request with the provider (keep as PENDING so provider can add estimated delivery time)
      const updatedRequest = await ctx.db.request.update({
        where: { id: input.requestId },
        data: {
          providerId: input.providerId,
          // Keep status unchanged to allow provider to start work and add estimated delivery
        },
        include: {
          client: { select: { id: true, name: true, email: true } },
          provider: { select: { id: true, name: true, email: true } },
          serviceType: true,
        },
      });

      // If reassigning, notify the previous creator that they lost the job.
      if (request.providerId && request.providerId !== input.providerId) {
        await notifyProviderUnassigned({
          providerId: request.providerId,
          requestId: input.requestId,
          requestTitle: request.title,
          locale: ctx.locale,
        });
      }

      await notifyProviderAssignment({
        requestId: input.requestId,
        providerId: input.providerId,
        providerName: provider.name || provider.email,
        locale: ctx.locale,
      });

      logRequestActivity({
        action: "request.assign",
        requestId: input.requestId,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        message: `Request assigned to ${provider.name || provider.email}: ${request.title}`,
        metadata: {
          previousProviderId: request.providerId,
          providerId: input.providerId,
          requestStatus: request.status,
        },
      });

      return {
        success: true,
        request: updatedRequest,
        message: `Request assigned to ${provider.name || provider.email}`,
      };
    }),

  // Unassign request from provider
  unassignRequest: requestManagerProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      if (!request.providerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Request is not assigned to any creator",
        });
      }

      const previousProviderId = request.providerId;

      const updatedRequest = await ctx.db.request.update({
        where: { id: input.requestId },
        data: {
          providerId: null,
          status: "PENDING",
        },
        include: {
          client: { select: { id: true, name: true, email: true } },
          provider: { select: { id: true, name: true, email: true } },
          serviceType: true,
        },
      });

      if (previousProviderId) {
        await notifyProviderUnassigned({
          providerId: previousProviderId,
          requestId: input.requestId,
          requestTitle: request.title,
          locale: ctx.locale,
        });
      }

      logRequestActivity({
        action: "request.unassign",
        requestId: input.requestId,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        message: `Request unassigned: ${request.title}`,
        metadata: {
          previousProviderId,
          previousStatus: request.status,
          newStatus: "PENDING",
        },
      });

      return {
        success: true,
        request: updatedRequest,
        message: "Request unassigned successfully",
      };
    }),

  // Create new user
  createUser: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email("Invalid email address").toLowerCase(),
        password: passwordSchema,
        role: z.enum(ASSIGNABLE_ROLES),
        phone: phoneWithCountryCodeSchema,
        supportedServiceIds: z.array(z.string()).optional(), // For providers only
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.role && isSuperAdmin(input.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Super admin accounts cannot be created through user management",
        });
      }

      // Check if user already exists
      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 12);

      // Create user
      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.role,
          phone: input.phone,
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          preferredLocale: ctx.locale === "ar" ? "ar" : "en",
        },
      });

      // Create provider profile if role is PROVIDER
      if (input.role === "PROVIDER") {
        await ctx.db.providerProfile.create({
          data: {
            userId: user.id,
            skillsTags: [],
            supportedServices: input.supportedServiceIds?.length
              ? { connect: input.supportedServiceIds.map((id: string) => ({ id })) }
              : undefined,
          },
        });
      }

      if (input.role === "CLIENT") {
        await assignFreeClientSubscription(ctx.db, user.id);
      }

      sendWelcomeEmail({
        userId: user.id,
        userName: user.name || "User",
        userEmail: user.email,
        userRole: user.role,
        locale: ctx.locale,
      }).catch(() => undefined);

      return {
        success: true,
        user,
      };
    }),

  /** Support: email a password reset link to a credentials user. */
  sendPasswordResetLink: adminProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirst({
        where: { id: input.userId, deletedAt: null },
        select: { id: true, email: true, name: true, password: true, role: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (isSuperAdmin(user.role) && user.id !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot send a reset link for another super admin",
        });
      }

      if (!user.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This account has no password to reset",
        });
      }

      const result = await issuePasswordResetEmail({
        db: ctx.db,
        user,
        locale: ctx.locale,
      });

      if (result !== "sent") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not send the reset email. Check email configuration and try again.",
        });
      }

      logActivityAsync({
        action: "admin.password_reset_link",
        message: `Admin sent password reset link to ${user.email}`,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        entityType: "User",
        entityId: user.id,
        metadata: { targetEmail: user.email },
      });

      return {
        success: true,
        message: "Password reset link sent",
      };
    }),

  // Update provider supported services
  updateProviderServices: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        serviceIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        include: { providerProfile: true },
      });

      if (!user || user.role !== "PROVIDER") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Creator not found",
        });
      }

      // Upsert provider profile with new services
      await ctx.db.providerProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          skillsTags: [],
          supportedServices: {
            connect: input.serviceIds.map((id: string) => ({ id })),
          },
        },
        update: {
          supportedServices: {
            set: input.serviceIds.map((id) => ({ id })),
          },
        },
      });

      return { success: true };
    }),

  // Get provider with their supported services
  getProviderDetails: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        include: {
          providerProfile: {
            include: {
              supportedServices: true,
            },
          },
        },
      });

      if (user?.role !== "PROVIDER") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Creator not found",
        });
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        supportedServices: user.providerProfile?.supportedServices || [],
      };
    }),

  // Set user active / inactive (inactive uses soft-delete)
  setUserActive: adminProcedure
    .input(z.object({ userId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (isSuperAdmin(user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Super admin accounts cannot be modified",
        });
      }

      const updatedUser = await ctx.db.user.update({
        where: { id: input.userId },
        data: input.isActive
          ? { deletedAt: null }
          : {
              deletedAt: new Date(),
              sessions: { deleteMany: {} },
              accounts: { deleteMany: {} },
            },
      });

      await invalidateSessionUserCache(input.userId);

      await notifyAccountActivationChanged({
        userId: user.id,
        userName: user.name || user.email,
        isActive: input.isActive,
        locale: ctx.locale,
      });

      return {
        success: true,
        message: `User ${user.email} has been ${input.isActive ? "activated" : "deactivated"}`,
        user: updatedUser,
      };
    }),

  approveUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        include: { providerProfile: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (isSuperAdmin(user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Super admin accounts cannot be modified",
        });
      }

      if (user.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reactivate the user before approving",
        });
      }

      if (user.approvalStatus === "APPROVED") {
        return { success: true, message: "User is already approved", user };
      }

      const updated = await ctx.db.user.update({
        where: { id: user.id },
        data: {
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
        },
      });

      if (user.role === "PROVIDER" && !user.providerProfile) {
        await ctx.db.providerProfile.create({
          data: { userId: user.id, skillsTags: [] },
        });
      }

      if (user.role === "CLIENT") {
        await assignFreeClientSubscription(ctx.db, user.id);
      }

      // In-app welcome + a single approval email (avoid double inbox noise).
      sendWelcomeEmail({
        userId: user.id,
        userName: user.name || "User",
        userEmail: user.email,
        userRole: user.role,
        locale: ctx.locale,
        email: false,
      }).catch(() => undefined);

      sendAccountApprovedEmail({
        userEmail: user.email,
        userName: user.name || "User",
        locale: ctx.locale,
      }).catch(() => undefined);

      await invalidateSessionUserCache(user.id);

      logActivityAsync({
        action: "admin.approve_user",
        message: `Approved user ${user.email}`,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email, role: user.role },
      });

      return {
        success: true,
        message: `User ${user.email} has been approved`,
        user: updated,
      };
    }),

  rejectUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (isSuperAdmin(user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Super admin accounts cannot be modified",
        });
      }

      const updated = await ctx.db.user.update({
        where: { id: user.id },
        data: {
          approvalStatus: "REJECTED",
          rejectedAt: new Date(),
          rejectionReason: input.reason?.trim() || null,
          sessions: { deleteMany: {} },
          accounts: { deleteMany: {} },
        },
      });

      await invalidateSessionUserCache(user.id);

      sendAccountRejectedEmail({
        userEmail: user.email,
        userName: user.name || "User",
        reason: input.reason,
        locale: ctx.locale,
      }).catch(() => undefined);

      logActivityAsync({
        action: "admin.reject_user",
        message: `Rejected user ${user.email}`,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email, reason: input.reason || null },
      });

      return {
        success: true,
        message: `User ${user.email} has been rejected`,
        user: updated,
      };
    }),

  // Delete request (soft delete)
  deleteRequest: requestManagerProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      await ctx.db.request.update({
        where: { id: input.requestId },
        data: {
          deletedAt: new Date(),
          status: "CANCELLED",
        },
      });

      const cancelRecipients: Array<{ userId: string; role: "PROVIDER" | "CLIENT" }> = [
        { userId: request.clientId, role: "CLIENT" },
      ];
      if (request.providerId) {
        cancelRecipients.push({ userId: request.providerId, role: "PROVIDER" });
      }
      await Promise.all(
        cancelRecipients.map((recipient) =>
          notifyRequestCancelled({
            userId: recipient.userId,
            requestId: input.requestId,
            requestTitle: request.title,
            role: recipient.role,
            locale: ctx.locale,
          })
        )
      );

      logRequestActivity({
        action: "request.delete",
        requestId: input.requestId,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        message: `Request cancelled/deleted: ${request.title}`,
        metadata: {
          previousStatus: request.status,
          newStatus: "CANCELLED",
        },
        level: "warn",
      });

      return {
        success: true,
        message: `Request "${request.title}" has been deleted`,
      };
    }),

  // Restore request
  restoreRequest: requestManagerProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.request.findUnique({
        where: { id: input.requestId },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found",
        });
      }

      await ctx.db.request.update({
        where: { id: input.requestId },
        data: {
          deletedAt: null,
        },
      });

      const restoreRecipients: Array<{ userId: string; role: "PROVIDER" | "CLIENT" }> = [
        { userId: request.clientId, role: "CLIENT" },
      ];
      if (request.providerId) {
        restoreRecipients.push({ userId: request.providerId, role: "PROVIDER" });
      }
      await Promise.all(
        restoreRecipients.map((recipient) =>
          notifyRequestRestored({
            userId: recipient.userId,
            requestId: input.requestId,
            requestTitle: request.title,
            role: recipient.role,
            locale: ctx.locale,
          })
        )
      );

      logRequestActivity({
        action: "request.restore",
        requestId: input.requestId,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        message: `Request restored: ${request.title}`,
        metadata: {
          status: request.status,
        },
      });

      return {
        success: true,
        message: `Request "${request.title}" has been restored`,
      };
    }),

  // Update user profile (admin only - name, email, phone, role)
  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email("Invalid email address").toLowerCase().optional(),
        phone: phoneWithCountryCodeSchema,
        role: z.enum(ASSIGNABLE_ROLES).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, name, email, phone, role } = input;

      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          _count: {
            select: {
              clientRequests: true,
              providerRequests: true,
            },
          },
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (isSuperAdmin(user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Super admin accounts cannot be modified",
        });
      }

      if (role && role !== user.role) {
        if (userId === ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You cannot change your own role",
          });
        }

        const blockReason = getRoleChangeBlockReason({
          currentRole: user.role,
          newRole: role,
          clientRequestCount: user._count.clientRequests,
          providerRequestCount: user._count.providerRequests,
        });
        if (blockReason) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: blockReason,
          });
        }
      }

      let nextEmail: string | undefined;
      // If email is being changed, check if it's already taken
      if (email && email !== user.email) {
        nextEmail = email.toLowerCase().trim();
        const existingUser = await ctx.db.user.findFirst({
          where: {
            email: nextEmail,
            id: { not: userId },
          },
        });

        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email already in use by another account",
          });
        }
      }

      const emailChanged = !!nextEmail && nextEmail !== user.email.toLowerCase().trim();
      const roleChanged = !!role && role !== user.role;

      const updatedUser = await ctx.db.user.update({
        where: { id: userId },
        data: {
          ...(name && { name }),
          ...(nextEmail && { email: nextEmail }),
          ...(phone !== undefined && { phone }),
          ...(roleChanged && { role }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      });

      if (roleChanged && role) {
        await invalidateSessionUserCache(userId);
        if (role === "PROVIDER") {
          await ctx.db.providerProfile.upsert({
            where: { userId },
            update: {},
            create: {
              userId,
              skillsTags: [],
            },
          });
        }
        await notifyRoleChanged({
          userId,
          userName: updatedUser.name || user.name || updatedUser.email,
          oldRole: user.role,
          newRole: role,
          locale: ctx.locale,
        });
      }

      if (emailChanged && nextEmail) {
        await notifyEmailChanged({
          userId,
          userName: updatedUser.name || user.name || nextEmail,
          oldEmail: user.email,
          newEmail: nextEmail,
          locale: ctx.locale,
        });
      }

      return {
        success: true,
        message: "User updated successfully",
        user: updatedUser,
      };
    }),

  getContactMessages: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["NEW", "READ", "ARCHIVED"]).optional(),
          limit: z.number().min(1).max(100).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const where = {
        ...(input?.status ? { status: input.status } : {}),
      };

      const rows = await ctx.db.contactMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | null = null;
      if (rows.length > limit) {
        const next = rows.pop();
        nextCursor = next?.id ?? null;
      }

      return { messages: rows, nextCursor };
    }),

  getContactMessage: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const message = await ctx.db.contactMessage.findUnique({ where: { id: input.id } });
      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact message not found" });
      }
      return message;
    }),

  updateContactMessageStatus: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(["NEW", "READ", "ARCHIVED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.contactMessage.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact message not found" });
      }

      const updated = await ctx.db.contactMessage.update({
        where: { id: input.id },
        data: {
          status: input.status,
          readAt:
            input.status === "READ" || input.status === "ARCHIVED"
              ? (existing.readAt ?? new Date())
              : null,
          readById:
            input.status === "READ" || input.status === "ARCHIVED"
              ? (existing.readById ?? ctx.session.user.id)
              : null,
        },
      });

      logActivityAsync({
        action: "contact.status",
        message: `Contact message marked ${input.status}: ${updated.email}`,
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        entityType: "ContactMessage",
        entityId: updated.id,
        metadata: { status: input.status, email: updated.email },
      });

      return updated;
    }),
});
