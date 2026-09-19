import { z } from "zod";
import { router, publicProcedure, adminProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { getOrSetCached, cacheKeys, cacheTTL } from "@/lib/cache";
import { invalidatePackageCache } from "@/lib/cache-invalidation";

const publicPackageSelect = {
  id: true,
  name: true,
  description: true,
  nameI18n: true,
  descriptionI18n: true,
  featuresI18n: true,
  price: true,
  credits: true,
  durationDays: true,
  features: true,
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
} as const;

export const packageRouter = router({
  // Get all active packages (public) - excludes free package
  getAll: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/package",
        tags: ["package"],
        summary: "List all active packages",
      },
    })
    .output(z.array(z.any()))
    .query(async ({ ctx }) => {
      return getOrSetCached(
        cacheKeys.PACKAGES,
        () =>
          ctx.db.package.findMany({
            where: {
              isActive: true,
              isFreePackage: false,
              deletedAt: null,
            },
            select: publicPackageSelect,
            orderBy: { sortOrder: "asc" },
          }),
        cacheTTL.PACKAGES
      );
    }),

  // Get single package by ID
  getById: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/package/{id}",
        tags: ["package"],
        summary: "Get package by ID",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.any())
    .query(async ({ ctx, input }) => {
      return getOrSetCached(
        cacheKeys.PACKAGE(input.id),
        async () => {
          const pkg = await ctx.db.package.findUnique({
            where: { id: input.id },
          });

          if (!pkg) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Package not found",
            });
          }

          return pkg;
        },
        cacheTTL.PACKAGES
      );
    }),

  // Create package (admin only)
  create: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/package",
        tags: ["package"],
        summary: "Create package (admin)",
      },
    })
    .input(
      z.object({
        name: z.string().min(2),
        description: z.string().optional(),
        credits: z.number().min(1),
        price: z.number().min(0),
        durationDays: z.number().min(1).default(30),
        features: z.array(z.string()).default([]),
        sortOrder: z.number().default(0),
      })
    )
    .output(z.object({ success: z.boolean(), package: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.create({
        data: {
          name: input.name,
          description: input.description,
          credits: input.credits,
          price: input.price,
          durationDays: input.durationDays,
          features: input.features,
          sortOrder: input.sortOrder,
        },
      });

      await invalidatePackageCache();

      return {
        success: true,
        package: pkg,
      };
    }),

  // Update package (admin only)
  update: adminProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/package",
        tags: ["package"],
        summary: "Update package (admin)",
      },
    })
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        credits: z.number().min(1).optional(),
        price: z.number().min(0).optional(),
        durationDays: z.number().min(1).optional(),
        features: z.array(z.string()).optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .output(z.object({ success: z.boolean(), package: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const pkg = await ctx.db.package.update({
        where: { id },
        data,
      });

      await invalidatePackageCache();

      return {
        success: true,
        package: pkg,
      };
    }),

  // Delete package (admin only) - soft delete by setting isActive to false
  delete: adminProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/package/{id}",
        tags: ["package"],
        summary: "Delete package (admin)",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ success: z.boolean(), package: z.any() }))
    .mutation(async ({ ctx, input }) => {
      // Prevent deletion of free package
      const pkg = await ctx.db.package.findUnique({
        where: { id: input.id },
      });

      if (pkg?.isFreePackage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete the free package. It is required for all new user registrations.",
        });
      }

      // Check if there are active subscriptions using this package
      const activeSubscriptions = await ctx.db.clientSubscription.count({
        where: {
          packageId: input.id,
          isActive: true,
          endDate: { gte: new Date() },
        },
      });

      if (activeSubscriptions > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete package with ${activeSubscriptions} active subscriptions. Deactivate it instead.`,
        });
      }

      const updated = await ctx.db.package.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      await invalidatePackageCache();

      return {
        success: true,
        package: updated,
      };
    }),
});
