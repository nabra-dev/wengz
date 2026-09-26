import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/notifications";
import { phoneWithCountryCodeSchema } from "@/lib/validations";
import { assignFreeClientSubscription } from "@/lib/free-client-subscription";
import { rateLimit } from "@/lib/rate-limit";
import { logActivityAsync } from "@/lib/activity-log";
import { logger } from "@/lib/logger";
import {
  buildPasswordResetUrl,
  consumePasswordResetToken,
  createPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/password-reset";

const DEFAULT_AVATAR = "/images/logo.svg";

const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

function getClientIp(req: unknown): string {
  const headersGet =
    req &&
    typeof req === "object" &&
    "headers" in req &&
    typeof (req as any).headers?.get === "function"
      ? (name: string) => (req as any).headers.get(name)
      : (name: string) => (req as any)?.headers?.[name];

  const forwardedFor = headersGet("x-forwarded-for");
  const realIp = headersGet("x-real-ip");
  return (
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() ||
    (Array.isArray(realIp) ? realIp[0] : realIp) ||
    "unknown"
  );
}

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
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address").toLowerCase(),
        password: z.string().min(1, "Password is required"),
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
    .input(z.void())
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
    .input(z.void())
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
        name: z.string().min(1).optional(),
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

  // Change password (logged-in)
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
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(1, "New password is required"),
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
        select: { id: true, password: true, email: true },
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

      const isSamePassword = await bcrypt.compare(input.newPassword, user.password);
      if (isSamePassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New password must be different from current password",
        });
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      logActivityAsync({
        action: "auth.password_change",
        message: `Password changed for ${user.email}`,
        actorId: user.id,
        actorRole: ctx.session.user.role,
        entityType: "User",
        entityId: user.id,
      });

      return {
        success: true,
        message: "Password changed successfully",
      };
    }),

  // Request password reset email (enumeration-safe)
  requestPasswordReset: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/auth/forgot-password",
        tags: ["auth"],
        summary: "Request a password reset email",
      },
    })
    .input(
      z.object({
        email: z.string().email("Invalid email address").toLowerCase(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);
      const rl = rateLimit(`forgot-password:${ip}:${input.email}`, {
        limit: 5,
        windowMs: 15 * 60_000,
      });
      if (!rl.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many reset attempts. Please try again later.",
        });
      }

      const user = await ctx.db.user.findFirst({
        where: { email: input.email, deletedAt: null },
        select: { id: true, email: true, name: true, password: true },
      });

      // Only credentials accounts can reset; still return a generic message.
      if (user?.password) {
        try {
          const { rawToken } = await createPasswordResetToken(ctx.db, user.id);
          const resetUrl = buildPasswordResetUrl(ctx.locale, rawToken);
          await sendPasswordResetEmail({
            userEmail: user.email,
            userName: user.name || "User",
            resetUrl,
            expiresInMinutes: Math.round(PASSWORD_RESET_TTL_MS / 60_000),
            locale: ctx.locale,
          });

          logActivityAsync({
            action: "auth.password_reset_request",
            message: `Password reset requested for ${user.email}`,
            actorId: user.id,
            actorRole: null,
            entityType: "User",
            entityId: user.id,
            ip,
          });
        } catch (error) {
          logger.error("Failed to process password reset request:", error);
          // Still return generic success to the client
        }
      }

      return {
        success: true,
        message: GENERIC_RESET_MESSAGE,
      };
    }),

  // Complete password reset with emailed token
  resetPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/auth/reset-password",
        tags: ["auth"],
        summary: "Reset password using a valid reset token",
      },
    })
    .input(
      z
        .object({
          token: z.string().min(1, "Reset token is required"),
          newPassword: z.string().min(1, "Password is required"),
          confirmPassword: z.string().min(1, "Confirm password is required"),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);
      const rl = rateLimit(`reset-password:${ip}`, { limit: 10, windowMs: 15 * 60_000 });
      if (!rl.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many reset attempts. Please try again later.",
        });
      }

      const consumed = await consumePasswordResetToken(ctx.db, input.token);
      if (!consumed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link is invalid or has expired. Please request a new one.",
        });
      }

      const user = await ctx.db.user.findFirst({
        where: { id: consumed.userId, deletedAt: null },
        select: { id: true, email: true, password: true },
      });

      if (!user?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link is invalid or has expired. Please request a new one.",
        });
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      logActivityAsync({
        action: "auth.password_reset",
        message: `Password reset completed for ${user.email}`,
        actorId: user.id,
        actorRole: null,
        entityType: "User",
        entityId: user.id,
        ip,
      });

      return {
        success: true,
        message: "Password updated. You can sign in with your new password.",
      };
    }),
});
