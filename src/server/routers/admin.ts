import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { router, adminProcedure, publicProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { notifyProviderAssignment, notifyProviderWithdrawalReviewed } from "@/lib/notifications";
import { phoneWithCountryCodeSchema } from "@/lib/validations";
import { assignFreeClientSubscription } from "@/lib/free-client-subscription";
import { reviewProviderWithdrawal, sendProviderPayout, settleCompletedRequest } from "@/lib/provider-wallet";
import { logActivityAsync } from "@/lib/activity-log";
import {
  CREDIT_PRICE_USD_KEY,
  getFinanceSettings as loadFinanceSettings,
  PROVIDER_COMMISSION_PERCENT_KEY,
} from "@/lib/finance-settings";

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

  getFinanceSettings: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/settings/finance",
        tags: ["admin"],
        summary: "Get global credit price and commission settings",
      },
    })
    .output(
      z.object({
        creditPriceUsd: z.number(),
        commissionPercent: z.number(),
      })
    )
    .query(async ({ ctx }) => loadFinanceSettings(ctx.db)),

  setFinanceSettings: adminProcedure
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
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        creditPriceUsd: z.number(),
        commissionPercent: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction([
        ctx.db.systemSettings.upsert({
          where: { key: CREDIT_PRICE_USD_KEY },
          update: {
            value: { amount: input.creditPriceUsd },
            description: "Global USD value of one credit for provider settlement.",
          },
          create: {
            key: CREDIT_PRICE_USD_KEY,
            value: { amount: input.creditPriceUsd },
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
      ]);

      return {
        success: true,
        creditPriceUsd: input.creditPriceUsd,
        commissionPercent: input.commissionPercent,
      };
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
    .output(z.array(z.any()))
    .query(async ({ ctx }) => {
      return ctx.db.package.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          isFreePackage: false, // Don't show free package on landing page
        },
        select: {
          id: true,
          name: true,
          nameI18n: true,
          description: true,
          descriptionI18n: true,
          price: true,
          credits: true,
          durationDays: true,
          features: true,
          featuresI18n: true,
          sortOrder: true,
          isFeatured: true,
          services: {
            select: {
              serviceType: {
                select: {
                  id: true,
                  name: true,
                  nameI18n: true,
                  icon: true,
                },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      });
    }),

  // Get dashboard stats
  getStats: adminProcedure
    .meta({
      openapi: { method: "GET", path: "/admin/stats", tags: ["admin"], summary: "Get admin stats" },
    })
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

      const [userRoles, requestStatuses, activeSubscriptions, serviceTypes, avgRating, revenueData] =
        await Promise.all([
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

      const roleCount = (role: string) =>
        userRoles.find((r) => r.role === role)?._count.id ?? 0;
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
  getAllSubscriptions: adminProcedure
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
  getFinanceOverview: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/admin/finance/overview",
        tags: ["admin"],
        summary: "Get provider wallet finance overview",
      },
    })
    .output(z.any())
    .query(async ({ ctx }) => {
      const [ledgerTotals, walletTotals, providers, unsettledCompletedRequests, pendingWithdrawals, financeSettings] =
        await Promise.all([
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
              pendingCredits: true,
              paidCredits: true,
              balanceUsd: true,
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
        ]);

      const providerWallets = providers.map((provider) => ({
        provider: {
          id: provider.id,
          name: provider.name,
          email: provider.email,
          image: provider.image,
        },
        balanceCredits: provider.providerWallet?.balanceCredits ?? 0,
        pendingCredits: provider.providerWallet?.pendingCredits ?? 0,
        paidCredits: provider.providerWallet?.paidCredits ?? 0,
        balanceUsd: provider.providerWallet?.balanceUsd ?? 0,
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
          totalPendingCredits: walletTotals._sum.pendingCredits ?? 0,
          totalPaidCredits: walletTotals._sum.paidCredits ?? 0,
          totalWalletBalanceUsd: walletTotals._sum.balanceUsd ?? 0,
          totalPendingUsd: walletTotals._sum.pendingUsd ?? 0,
          totalPaidUsd: walletTotals._sum.paidUsd ?? 0,
          unsettledCompletedRequests,
          pendingWithdrawals,
          creditPriceUsd: financeSettings.creditPriceUsd,
          commissionPercent: financeSettings.commissionPercent,
        },
        providerWallets,
      };
    }),

  getProviderFinanceLedger: adminProcedure
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

  getWithdrawals: adminProcedure
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

  reviewWithdrawal: adminProcedure
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
        reason: z.string().min(5).max(500),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const withdrawal = await ctx.db.$transaction((tx) =>
        reviewProviderWithdrawal(tx, {
          withdrawalId: input.withdrawalId,
          adminId: ctx.session.user.id,
          status: input.status,
          reason: input.reason,
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
        actorRole: "SUPER_ADMIN",
        entityType: "WithdrawalRequest",
        entityId: withdrawal.id,
        metadata: {
          status: input.status,
          amountUsd: withdrawal.amountUsd,
          providerId: withdrawal.providerId,
          reason: input.reason.trim(),
        },
      });

      return { success: true };
    }),

  sendProviderPayout: adminProcedure
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
        reason: z.string().min(5).max(500),
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
        message: `Admin payout ${withdrawal.amountUsd} USD to provider`,
        actorId: ctx.session.user.id,
        actorRole: "SUPER_ADMIN",
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
  settleUnsettledCompletedRequests: adminProcedure
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
          errors.push(
            `${request.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      logActivityAsync({
        action: "wallet.settle",
        message: `Settled ${settled} unsettled request(s); skipped ${skipped}`,
        actorId: ctx.session.user.id,
        actorRole: "SUPER_ADMIN",
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
        action?: string;
        level?: string;
        actorId?: string;
      } = {};
      if (input?.action) where.action = input.action;
      if (input?.level) where.level = input.level;
      if (input?.actorId) where.actorId = input.actorId;

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

  // Get all users
  getUsers: adminProcedure
    .meta({
      openapi: { method: "GET", path: "/admin/users", tags: ["admin"], summary: "List users" },
    })
    .input(
      z
        .object({
          role: z.enum(["SUPER_ADMIN", "PROVIDER", "CLIENT"]).optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().default(0),
          search: z.string().optional(),
          showDeleted: z.boolean().optional(),
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

      // Filter by deletion status
      if (input?.showDeleted) {
        where.deletedAt = { not: null };
      } else {
        where.deletedAt = null;
      }

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            hasWhatsapp: true,
            image: true,
            role: true,
            createdAt: true,
            providerProfile: {
              select: {
                id: true,
                supportedServices: {
                  select: { id: true, name: true, nameI18n: true },
                },
              },
            },
            receivedRatings: {
              select: {
                rating: true,
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
      ]);

      // Calculate average rating for each provider
      const usersWithRating = users.map((user: any) => {
        const ratings = user.receivedRatings;
        const avgRating =
          ratings.length > 0
            ? ratings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
              ratings.length
            : null;

        return {
          ...user,
          averageRating: avgRating,
          receivedRatings: undefined, // Remove from response
        };
      });

      return {
        users: usersWithRating,
        total,
        hasMore: (input?.offset || 0) + users.length < total,
      };
    }),

  // Get all requests
  getAllRequests: adminProcedure
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
        name: z.string().min(2),
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
        priorityCostLow: z.number().min(0).default(0), // Additional credits for low priority
        priorityCostMedium: z.number().min(0).default(1), // Additional credits for medium priority
        priorityCostHigh: z.number().min(0).default(2), // Additional credits for high priority
        maxDeliveryMinutes: z.number().min(15).default(480), // Max estimated delivery time in minutes
        sortOrder: z.number().default(0),
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
          priorityCostLow: input.priorityCostLow,
          priorityCostMedium: input.priorityCostMedium,
          priorityCostHigh: input.priorityCostHigh,
          maxDeliveryMinutes: input.maxDeliveryMinutes,
          sortOrder: input.sortOrder,
        } as any,
      });

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
        name: z.string().min(2).optional(),
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
        priorityCostLow: z.number().min(0).optional(), // Additional credits for low priority
        priorityCostMedium: z.number().min(0).optional(), // Additional credits for medium priority
        priorityCostHigh: z.number().min(0).optional(), // Additional credits for high priority
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

      return {
        success: true,
        serviceType,
      };
    }),

  // Delete service type (soft delete)
  deleteServiceType: adminProcedure
    .input(z.object({ id: z.string() }))
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

      // Soft delete the service type
      await ctx.db.serviceType.update({
        where: { id: input.id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      return { success: true, message: `Service type "${serviceType.name}" has been deleted` };
    }),

  // Restore service type
  restoreServiceType: adminProcedure
    .input(z.object({ id: z.string() }))
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
          deletedAt: null,
          isActive: true,
        },
      });

      return { success: true, message: `Service type "${serviceType.name}" has been restored` };
    }),

  // Create package
  createPackage: adminProcedure
    .input(
      z.object({
        name: z.string().min(2),
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

      return { success: true, package: pkg };
    }),

  // Update package
  updatePackage: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        nameI18n: z.record(z.string()).optional(),
        description: z.string().optional(),
        descriptionI18n: z.record(z.string()).optional(),
        price: z.number().min(0).optional(),
        credits: z.number().min(1).optional(),
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

      if (input.isFeatured === true) {
        await clearFeaturedExcept(ctx.db, id);
      }

      // Update package and handle services if provided
      const pkg = await ctx.db.package.update({
        where: { id },
        data: {
          ...data,
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

      return { success: true, package: pkg };
    }),

  // Delete package (soft delete)
  deletePackage: adminProcedure
    .input(z.object({ id: z.string() }))
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

      // Prevent deletion of free package
      if (pkg.isFreePackage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete the free package",
        });
      }

      // Soft delete the package
      await ctx.db.package.update({
        where: { id: input.id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      return { success: true, message: `Package "${pkg.name}" has been deleted` };
    }),

  // Restore package
  restorePackage: adminProcedure
    .input(z.object({ id: z.string() }))
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

      await ctx.db.package.update({
        where: { id: input.id },
        data: {
          deletedAt: null,
          isActive: true,
        },
      });

      return { success: true, message: `Package "${pkg.name}" has been restored` };
    }),

  // Get all service types
  getServiceTypes: adminProcedure
    .input(z.object({ showDeleted: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const showDeleted = input?.showDeleted ?? false;
      return ctx.db.serviceType.findMany({
        where: showDeleted ? { deletedAt: { not: null } } : { deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { requests: true } },
        },
      });
    }),

  // Get all packages (admin only, includes deleted)
  getPackages: adminProcedure
    .input(z.object({ showDeleted: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const showDeleted = input?.showDeleted ?? false;
      return ctx.db.package.findMany({
        where: showDeleted
          ? { deletedAt: { not: null }, isFreePackage: false }
          : { deletedAt: null, isFreePackage: false },
        orderBy: { sortOrder: "asc" },
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
        role: z.enum(["SUPER_ADMIN", "PROVIDER", "CLIENT"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent admin from changing their own role
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot change your own role",
        });
      }

      const user = await ctx.db.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });

      // Create provider profile if changing to provider
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

      return {
        success: true,
        user,
      };
    }),

  // Get all providers for assignment
  getProviders: adminProcedure
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

  // Assign request to provider
  assignRequest: adminProcedure
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
          message: "Provider not found",
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

      // Notify provider about assignment
      await notifyProviderAssignment({
        requestId: input.requestId,
        providerId: input.providerId,
        providerName: provider.name || provider.email,
      });

      return {
        success: true,
        request: updatedRequest,
        message: `Request assigned to ${provider.name || provider.email}`,
      };
    }),

  // Unassign request from provider
  unassignRequest: adminProcedure
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
          message: "Request is not assigned to any provider",
        });
      }

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
        name: z.string().min(2),
        email: z.string().email("Invalid email address").toLowerCase(),
        password: z.string().min(6),
        role: z.enum(["CLIENT", "PROVIDER", "SUPER_ADMIN"]),
        phone: phoneWithCountryCodeSchema,
        hasWhatsapp: z.boolean().optional(),
        supportedServiceIds: z.array(z.string()).optional(), // For providers only
      })
    )
    .mutation(async ({ ctx, input }) => {
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
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create user
      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.role,
          phone: input.phone,
          hasWhatsapp: input.hasWhatsapp ?? false,
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

      return {
        success: true,
        user,
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
          message: "Provider not found",
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
          message: "Provider not found",
        });
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        supportedServices: user.providerProfile?.supportedServices || [],
      };
    }),

  // Delete user (soft delete)
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
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

      // Prevent deletion of super admin
      if (user.role === "SUPER_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete a super admin user",
        });
      }

      // Soft delete the user
      const deletedUser = await ctx.db.user.update({
        where: { id: input.userId },
        data: {
          deletedAt: new Date(),
        },
      });

      return {
        success: true,
        message: `User ${user.email} has been deleted`,
        user: deletedUser,
      };
    }),

  // Restore user
  restoreUser: adminProcedure
    .input(z.object({ userId: z.string() }))
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

      const restoredUser = await ctx.db.user.update({
        where: { id: input.userId },
        data: {
          deletedAt: null,
        },
      });

      return {
        success: true,
        message: `User ${user.email} has been restored`,
        user: restoredUser,
      };
    }),

  // Delete request (soft delete)
  deleteRequest: adminProcedure
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

      return {
        success: true,
        message: `Request "${request.title}" has been deleted`,
      };
    }),

  // Restore request
  restoreRequest: adminProcedure
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

      return {
        success: true,
        message: `Request "${request.title}" has been restored`,
      };
    }),

  // Update user profile (admin only - name and email)
  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(2, "Name must be at least 2 characters").optional(),
        email: z.string().email("Invalid email address").toLowerCase().optional(),
        phone: phoneWithCountryCodeSchema,
        hasWhatsapp: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, name, email, phone, hasWhatsapp } = input;

      // Check if user exists
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // If email is being changed, check if it's already taken
      if (email && email !== user.email) {
        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await ctx.db.user.findFirst({
          where: {
            email: normalizedEmail,
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

      const updatedUser = await ctx.db.user.update({
        where: { id: userId },
        data: {
          ...(name && { name }),
          ...(email && { email }),
          ...(phone !== undefined && { phone }),
          ...(hasWhatsapp !== undefined && { hasWhatsapp }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          hasWhatsapp: true,
          role: true,
        },
      });

      return {
        success: true,
        message: "User updated successfully",
        user: updatedUser,
      };
    }),
});
