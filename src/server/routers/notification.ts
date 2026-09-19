import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc";
import { getOrSetCached, cacheKeys, cacheTTL } from "@/lib/cache";
import { invalidateNotificationsCache } from "@/lib/cache-invalidation";

export const notificationRouter = router({
  // Get notifications for current user
  getAll: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/notification",
        tags: ["notification"],
        summary: "List notifications",
      },
    })
    .input(
      z
        .object({
          unreadOnly: z.boolean().default(false),
          limit: z.number().min(1).max(100).default(20),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .output(z.object({ notifications: z.array(z.any()), nextCursor: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const where: any = { userId };
      if (input?.unreadOnly) {
        where.isRead = false;
      }

      const notifications = await ctx.db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input?.limit || 20,
        cursor: input?.cursor ? { id: input.cursor } : undefined,
        skip: input?.cursor ? 1 : 0,
      });

      return {
        notifications,
        nextCursor:
          notifications.length === (input?.limit || 20) ? (notifications.at(-1)?.id ?? null) : null,
      };
    }),

  // Get unread count
  getUnreadCount: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/notification/unread-count",
        tags: ["notification"],
        summary: "Get unread notification count",
      },
    })
    .output(z.object({ count: z.number() }))
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      return getOrSetCached(
        cacheKeys.UNREAD_COUNT(userId),
        async () => {
          const count = await ctx.db.notification.count({
            where: {
              userId,
              isRead: false,
            },
          });
          return { count };
        },
        cacheTTL.NOTIFICATIONS
      );
    }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/notification/mark-read",
        tags: ["notification"],
        summary: "Mark notification as read",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const notification = await ctx.db.notification.updateMany({
        where: {
          id: input.id,
          userId, // Ensure user owns this notification
        },
        data: { isRead: true },
      });

      await invalidateNotificationsCache(userId);

      return { success: notification.count > 0 };
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/notification/mark-all-read",
        tags: ["notification"],
        summary: "Mark all as read",
      },
    })
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      await ctx.db.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: { isRead: true },
      });

      await invalidateNotificationsCache(userId);

      return { success: true };
    }),

  // Delete notification
  delete: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/notification/{id}",
        tags: ["notification"],
        summary: "Delete notification",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const result = await ctx.db.notification.deleteMany({
        where: {
          id: input.id,
          userId,
        },
      });

      await invalidateNotificationsCache(userId);

      return { success: result.count > 0 };
    }),

  // Delete all read notifications
  deleteAllRead: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/notification/read",
        tags: ["notification"],
        summary: "Delete all read notifications",
      },
    })
    .output(z.object({ success: z.boolean(), deleted: z.number() }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;

      const result = await ctx.db.notification.deleteMany({
        where: {
          userId,
          isRead: true,
        },
      });

      return { success: true, deleted: result.count };
    }),
});
