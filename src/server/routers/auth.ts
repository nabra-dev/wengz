import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { sendWelcomeEmail } from "@/lib/notifications";
import { phoneWithCountryCodeSchema } from "@/lib/validations";
import { assignFreeClientSubscription } from "@/lib/free-client-subscription";
import { rateLimit } from "@/lib/rate-limit";
import { logActivityAsync } from "@/lib/activity-log";
import { logger } from "@/lib/logger";

const DEFAULT_AVATAR = "/images/logo.svg";

export const authRouter = router({
  // Register a new user
  register: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/auth/register",
        tags: ["auth"],
        summary: "Register a new user",
      },
    })
    .input(
      z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address").toLowerCase(),
        password: z.string().min(6, "Password must be at least 6 characters"),
        phone: phoneWithCountryCodeSchema,
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit registrations per IP to slow down bulk account creation
      // (free-trial abuse, spam).
      const forwardedFor =
        ctx.req && "headers" in ctx.req && typeof (ctx.req as any).headers?.get === "function"
          ? (ctx.req as any).headers.get("x-forwarded-for")
          : (ctx.req as any)?.headers?.["x-forwarded-for"];
      const realIpHeader =
        ctx.req && "headers" in ctx.req && typeof (ctx.req as any).headers?.get === "function"
          ? (ctx.req as any).headers.get("x-real-ip")
          : (ctx.req as any)?.headers?.["x-real-ip"];
      const ipForLimit =
        (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() ||
        (Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader) ||
        "unknown";

      const rl = rateLimit(`register:${ipForLimit}`, { limit: 5, windowMs: 60_000 });
      if (!rl.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many registration attempts. Please try again shortly.",
        });
      }

      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already registered",
        });
      }

      // Capture IP for audit, but do not restrict by IP
      const forwarded =
        ctx.req && "headers" in ctx.req && typeof (ctx.req as any).headers?.get === "function"
          ? (ctx.req as any).headers.get("x-forwarded-for")
          : (ctx.req as any)?.headers?.["x-forwarded-for"];

      const realIp =
        ctx.req && "headers" in ctx.req && typeof (ctx.req as any).headers?.get === "function"
          ? (ctx.req as any).headers.get("x-real-ip")
          : (ctx.req as any)?.headers?.["x-real-ip"];

      const forwardedString = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      const realIpString = Array.isArray(realIp) ? realIp[0] : realIp;
      const ip = forwardedString?.split(",")[0] || realIpString || null;

      const hashedPassword = await bcrypt.hash(input.password, 12);

      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          phone: input.phone || null,
          image: DEFAULT_AVATAR,
          role: "CLIENT", // Default role
          registrationIp: ip,
        },
      });

      await assignFreeClientSubscription(ctx.db, user.id);

      // Send welcome email (non-blocking)
      sendWelcomeEmail({
        userId: user.id,
        userName: user.name || "User",
        userEmail: user.email,
        userRole: user.role,
        locale: ctx.locale,
      }).catch((error) => {
        logger.error("Failed to send welcome email:", error);
        // Don't throw - email failure shouldn't break registration
      });

      logActivityAsync({
        action: "auth.register",
        message: `New client registered: ${user.email}`,
        actorId: user.id,
        actorRole: "CLIENT",
        entityType: "User",
        entityId: user.id,
        ip,
        metadata: { email: user.email },
      });

      return {
        success: true,
        message: "Account created successfully",
        userId: user.id,
      };
    }),

  // Get current session
  getSession: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/auth/session",
        tags: ["auth"],
        summary: "Get current session",
      },
    })
    .output(
      z
        .object({
          user: z
            .object({
              id: z.string(),
              name: z.string().nullable().optional(),
              email: z.string().email().nullable().optional(),
              role: z.string().nullable().optional(),
              image: z.string().url().nullable().optional(),
            })
            .nullable()
            .optional(),
        })
        .nullable()
    )
    .query(async ({ ctx }) => {
      return ctx.session as any;
    }),

  // Get current user profile
  getProfile: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/auth/profile",
        tags: ["auth"],
        summary: "Get current user profile",
      },
    })
    .output(
      z.object({
        id: z.string(),
        name: z.string().nullable().optional(),
        email: z.string().email(),
        role: z.string(),
        image: z.string().url().nullable().optional(),
        createdAt: z.date(),
        providerProfile: z.any().nullable().optional(),
      })
    )
    .query(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        include: {
          providerProfile: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image || DEFAULT_AVATAR,
        createdAt: user.createdAt,
        providerProfile: user.providerProfile,
      };
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/auth/profile",
        tags: ["auth"],
        summary: "Update current user profile",
      },
    })
    .input(
      z.object({
        name: z.string().min(2).optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        user: z.object({
          id: z.string(),
          name: z.string().nullable().optional(),
          email: z.string().email(),
          image: z.string().url().nullable().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          name: input.name,
        },
      });

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image || DEFAULT_AVATAR,
        },
      };
    }),

  // Change password
  changePassword: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/auth/change-password",
        tags: ["auth"],
        summary: "Change current user password",
      },
    })
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6, "Password must be at least 6 characters"),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
      });

      if (!user?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change password for OAuth accounts",
        });
      }

      const isValid = await bcrypt.compare(input.currentPassword, user.password);

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);

      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { password: hashedPassword },
      });

      return {
        success: true,
        message: "Password changed successfully",
      };
    }),
});
