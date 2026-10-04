import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, publicProcedure, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { notifyAdminsNewUserRegistration, sendApplicationReceivedEmail } from "@/lib/notifications";
import { passwordSchema, phoneWithCountryCodeSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { logActivityAsync } from "@/lib/activity-log";
import { logger } from "@/lib/logger";
import { issuePasswordResetEmail } from "@/lib/issue-password-reset";
import { finalizePasswordReset, findValidPasswordResetToken } from "@/lib/password-reset";
import { invalidateSessionUserCache } from "@/lib/session-user-cache";
import { isAllowedProviderCvUrl } from "@/lib/upload-url";
import { sendEmail, getOpsNotifyEmailHtml } from "@/lib/notifications/email";
import { mobileClientLogin } from "@/lib/mobile-auth";

const DEFAULT_AVATAR = "/images/logo.svg";

const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

const requiredPhoneSchema = z
  .string()
  .regex(
    /^\+[1-9]\d{1,3}\s\d{7,15}$/,
    "Phone must be in format: +countryCode phoneNumber (e.g., +20 1234567890)"
  );

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
        password: passwordSchema,
        phone: phoneWithCountryCodeSchema,
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        userId: z.string(),
        reapplied: z.boolean().optional(),
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

      if (existingUser) {
        if (existingUser.approvalStatus === "PENDING") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An application with this email is already pending review.",
          });
        }
        if (existingUser.approvalStatus !== "REJECTED") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email already registered",
          });
        }

        // Rejected applicants may re-apply with the same email.
        const user = await ctx.db.user.update({
          where: { id: existingUser.id },
          data: {
            name: input.name,
            password: hashedPassword,
            phone: input.phone || null,
            image: existingUser.image || DEFAULT_AVATAR,
            role: "CLIENT",
            approvalStatus: "PENDING",
            approvedAt: null,
            rejectedAt: null,
            rejectionReason: null,
            deletedAt: null,
            registrationIp: ip,
            sessions: { deleteMany: {} },
            accounts: { deleteMany: {} },
          },
        });

        sendApplicationReceivedEmail({
          userEmail: user.email,
          userName: user.name || "User",
          userRole: "CLIENT",
          locale: ctx.locale,
        }).catch((error) => {
          logger.error("Failed to send application received email:", error);
        });

        void notifyAdminsNewUserRegistration({
          userName: user.name || "User",
          userEmail: user.email,
          userRole: "CLIENT",
          userId: user.id,
          reapplied: true,
        }).catch((error) => {
          logger.error("Failed to notify admins of client re-application:", error);
        });

        logActivityAsync({
          action: "auth.register_reapply",
          message: `Client re-applied after rejection: ${user.email}`,
          actorId: user.id,
          actorRole: "CLIENT",
          entityType: "User",
          entityId: user.id,
          ip,
          metadata: { email: user.email, approvalStatus: "PENDING", reapply: true },
        });

        return {
          success: true,
          reapplied: true,
          message: "Application re-submitted. An admin will review it shortly.",
          userId: user.id,
        };
      }

      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          phone: input.phone || null,
          image: DEFAULT_AVATAR,
          role: "CLIENT",
          approvalStatus: "PENDING",
          registrationIp: ip,
          preferredLocale: ctx.locale === "ar" ? "ar" : "en",
        },
      });

      sendApplicationReceivedEmail({
        userEmail: user.email,
        userName: user.name || "User",
        userRole: "CLIENT",
        locale: ctx.locale,
      }).catch((error) => {
        logger.error("Failed to send application received email:", error);
      });

      void notifyAdminsNewUserRegistration({
        userName: user.name || "User",
        userEmail: user.email,
        userRole: "CLIENT",
        userId: user.id,
      }).catch((error) => {
        logger.error("Failed to notify admins of client registration:", error);
      });

      logActivityAsync({
        action: "auth.register",
        message: `New client application pending: ${user.email}`,
        actorId: user.id,
        actorRole: "CLIENT",
        entityType: "User",
        entityId: user.id,
        ip,
        metadata: { email: user.email, approvalStatus: "PENDING" },
      });

      return {
        success: true,
        message: "Application submitted. An admin will review it shortly.",
        userId: user.id,
      };
    }),

  /**
   * Client-only mobile login — returns a Bearer access token (NextAuth-compatible JWT).
   * Web continues to use NextAuth cookie sessions.
   */
  mobileLogin: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/auth/mobile-login",
        tags: ["auth", "mobile"],
        summary: "Client mobile login (Bearer token)",
        protect: false,
      },
    })
    .input(
      z.object({
        email: z.string().email().toLowerCase(),
        password: z.string().min(1),
      })
    )
    .output(
      z.object({
        accessToken: z.string(),
        tokenType: z.literal("Bearer"),
        expiresIn: z.number(),
        user: z.object({
          id: z.string(),
          email: z.string(),
          name: z.string(),
          role: z.string(),
          image: z.string().nullable(),
          phone: z.string().nullable(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await mobileClientLogin({
        email: input.email,
        password: input.password,
        ip: getClientIp(ctx.req),
      });

      if (!result.ok) {
        const codeMap: Record<
          string,
          "UNAUTHORIZED" | "FORBIDDEN" | "TOO_MANY_REQUESTS" | "PRECONDITION_FAILED"
        > = {
          INVALID_CREDENTIALS: "UNAUTHORIZED",
          ACCOUNT_PENDING_APPROVAL: "FORBIDDEN",
          ACCOUNT_REJECTED: "FORBIDDEN",
          CLIENT_ONLY: "FORBIDDEN",
          MAINTENANCE_MODE: "PRECONDITION_FAILED",
          RATE_LIMITED: "TOO_MANY_REQUESTS",
        };
        throw new TRPCError({
          code: codeMap[result.code] ?? "UNAUTHORIZED",
          message: `${result.code}:${result.message}`,
        });
      }

      return {
        accessToken: result.accessToken,
        tokenType: "Bearer" as const,
        expiresIn: result.expiresIn,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          image: result.user.image,
          phone: result.user.phone,
        },
      };
    }),

  /** Public provider application — creates PENDING PROVIDER + profile. */
  registerProvider: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/auth/register-provider",
        tags: ["auth"],
        summary: "Submit a provider application (pending approval)",
      },
    })
    .input(
      z
        .object({
          name: z.string().min(1, "Name is required"),
          email: z.string().email("Invalid email address").toLowerCase(),
          password: passwordSchema,
          confirmPassword: passwordSchema,
          phone: requiredPhoneSchema,
          website: z.string().optional().default(""),
          message: z.string().optional().default(""),
          cvUrl: z
            .string()
            .optional()
            .default("")
            .refine(
              (value) => !value || isAllowedProviderCvUrl(value),
              "Upload a valid CV (PDF or Word)"
            ),
          serviceIds: z.array(z.string().min(1)).min(1, "Select at least one service"),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        userId: z.string(),
        reapplied: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      const rl = rateLimit(`register-provider:${ipForLimit}`, { limit: 5, windowMs: 60_000 });
      if (!rl.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many registration attempts. Please try again shortly.",
        });
      }

      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
        include: { providerProfile: true },
      });

      const uniqueServiceIds = [...new Set(input.serviceIds)];
      const activeServices = await ctx.db.serviceType.findMany({
        where: {
          id: { in: uniqueServiceIds },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true, name: true, nameI18n: true },
      });

      if (activeServices.length !== uniqueServiceIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more selected services are invalid",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 12);
      const messageBody = input.message.trim();
      const bio = messageBody || null;
      const serviceLabels = activeServices
        .map((s) => {
          const i18n = s.nameI18n as Record<string, string> | null;
          return i18n?.[ctx.locale] || s.name;
        })
        .join(", ");
      const registrationIp = ipForLimit === "unknown" ? null : ipForLimit;

      if (existingUser) {
        if (existingUser.approvalStatus === "PENDING") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An application with this email is already pending review.",
          });
        }
        if (existingUser.approvalStatus !== "REJECTED") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email already registered",
          });
        }

        const user = await ctx.db.user.update({
          where: { id: existingUser.id },
          data: {
            name: input.name,
            password: hashedPassword,
            phone: input.phone,
            image: existingUser.image || DEFAULT_AVATAR,
            role: "PROVIDER",
            approvalStatus: "PENDING",
            approvedAt: null,
            rejectedAt: null,
            rejectionReason: null,
            deletedAt: null,
            registrationIp,
            sessions: { deleteMany: {} },
            accounts: { deleteMany: {} },
            providerProfile: existingUser.providerProfile
              ? {
                  update: {
                    bio,
                    portfolio: input.website.trim() || null,
                    cvUrl: input.cvUrl.trim() || null,
                    skillsTags: [],
                    isActive: true,
                    supportedServices: {
                      set: uniqueServiceIds.map((id) => ({ id })),
                    },
                  },
                }
              : {
                  create: {
                    bio,
                    portfolio: input.website.trim() || null,
                    cvUrl: input.cvUrl.trim() || null,
                    skillsTags: [],
                    isActive: true,
                    supportedServices: {
                      connect: uniqueServiceIds.map((id) => ({ id })),
                    },
                  },
                },
          },
        });

        sendApplicationReceivedEmail({
          userEmail: user.email,
          userName: user.name || "User",
          userRole: "PROVIDER",
          locale: ctx.locale,
        }).catch((error) => {
          logger.error("Failed to send provider application received email:", error);
        });

        void notifyAdminsNewUserRegistration({
          userName: user.name || "User",
          userEmail: user.email,
          userRole: "PROVIDER",
          userId: user.id,
          reapplied: true,
        }).catch((error) => {
          logger.error("Failed to notify admins of provider re-application:", error);
        });

        const recipient = process.env.CONTACT_FORMS_RECIPIENT || "info@wengz.tech";
        void getOpsNotifyEmailHtml({
          title: "Provider re-application (pending approval)",
          rows: [
            { label: "Name", value: user.name || "—" },
            { label: "Email", value: user.email },
            { label: "Phone", value: input.phone },
            { label: "Website", value: input.website.trim() || "—" },
            { label: "CV", value: input.cvUrl.trim() || "—" },
            { label: "Services", value: serviceLabels || "—" },
          ],
          messageBody: messageBody || "—",
        })
          .then((html) =>
            sendEmail({
              to: recipient,
              subject: `Provider re-application pending — ${user.name || user.email}`,
              html,
              replyTo: user.email,
            })
          )
          .catch(() => undefined);

        logActivityAsync({
          action: "auth.register_provider_reapply",
          message: `Provider re-applied after rejection: ${user.email}`,
          actorId: user.id,
          actorRole: "PROVIDER",
          entityType: "User",
          entityId: user.id,
          ip: registrationIp,
          metadata: {
            email: user.email,
            approvalStatus: "PENDING",
            serviceIds: uniqueServiceIds,
            reapply: true,
          },
        });

        return {
          success: true,
          reapplied: true,
          message: "Application re-submitted. An admin will review it shortly.",
          userId: user.id,
        };
      }

      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          phone: input.phone,
          image: DEFAULT_AVATAR,
          role: "PROVIDER",
          approvalStatus: "PENDING",
          registrationIp,
          preferredLocale: ctx.locale === "ar" ? "ar" : "en",
          providerProfile: {
            create: {
              bio,
              portfolio: input.website.trim() || null,
              cvUrl: input.cvUrl.trim() || null,
              skillsTags: [],
              isActive: true,
              supportedServices: {
                connect: uniqueServiceIds.map((id) => ({ id })),
              },
            },
          },
        },
      });

      sendApplicationReceivedEmail({
        userEmail: user.email,
        userName: user.name || "User",
        userRole: "PROVIDER",
        locale: ctx.locale,
      }).catch((error) => {
        logger.error("Failed to send provider application received email:", error);
      });

      void notifyAdminsNewUserRegistration({
        userName: user.name || "User",
        userEmail: user.email,
        userRole: "PROVIDER",
        userId: user.id,
      }).catch((error) => {
        logger.error("Failed to notify admins of provider registration:", error);
      });

      // Ops notify (best-effort) — same recipient as legacy contact form
      const recipient = process.env.CONTACT_FORMS_RECIPIENT || "info@wengz.tech";
      void getOpsNotifyEmailHtml({
        title: "New provider application (pending approval)",
        rows: [
          { label: "Name", value: user.name || "—" },
          { label: "Email", value: user.email },
          { label: "Phone", value: input.phone },
          { label: "Website", value: input.website.trim() || "—" },
          { label: "CV", value: input.cvUrl.trim() || "—" },
          { label: "Services", value: serviceLabels || "—" },
        ],
        messageBody: messageBody || "—",
      })
        .then((html) =>
          sendEmail({
            to: recipient,
            subject: `Provider application pending — ${user.name || user.email}`,
            html,
            replyTo: user.email,
          })
        )
        .catch(() => undefined);

      logActivityAsync({
        action: "auth.register_provider",
        message: `New provider application pending: ${user.email}`,
        actorId: user.id,
        actorRole: "PROVIDER",
        entityType: "User",
        entityId: user.id,
        ip: registrationIp,
        metadata: {
          email: user.email,
          approvalStatus: "PENDING",
          serviceIds: uniqueServiceIds,
        },
      });

      return {
        success: true,
        message: "Application submitted. An admin will review it shortly.",
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
        const result = await issuePasswordResetEmail({
          db: ctx.db,
          user,
          locale: ctx.locale,
        });
        if (result === "sent") {
          logActivityAsync({
            action: "auth.password_reset_request",
            message: `Password reset requested for ${user.email}`,
            actorId: user.id,
            actorRole: null,
            entityType: "User",
            entityId: user.id,
            ip,
          });
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
          newPassword: passwordSchema,
          confirmPassword: passwordSchema,
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

      const tokenRow = await findValidPasswordResetToken(ctx.db, input.token);
      if (!tokenRow) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link is invalid or has expired. Please request a new one.",
        });
      }

      const user = await ctx.db.user.findFirst({
        where: { id: tokenRow.userId, deletedAt: null },
        select: { id: true, email: true, password: true },
      });

      if (!user?.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link is invalid or has expired. Please request a new one.",
        });
      }

      const isSamePassword = await bcrypt.compare(input.newPassword, user.password);
      if (isSamePassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New password must be different from your current password",
        });
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      const finalized = await finalizePasswordReset(ctx.db, tokenRow.id, user.id, hashedPassword);
      if (!finalized) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link is invalid or has expired. Please request a new one.",
        });
      }
      await invalidateSessionUserCache(user.id);

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
