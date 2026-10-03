import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { passwordSchema, phoneWithCountryCodeSchema } from "@/lib/validations";
import { logActivityAsync } from "@/lib/activity-log";
import { persistPasswordChange } from "@/lib/password-reset";
import { invalidateSessionUserCache } from "@/lib/session-user-cache";
import { isAllowedUploadUrl } from "@/lib/upload-url";
import {
  notifyEmailChanged,
  notifyPasswordChanged,
  sendAccountDeletedEmail,
} from "@/lib/notifications";
import { normalizeAppLocale } from "@/lib/notifications/i18n-helper";

const PROFILE_IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

function isOwnProfileImageUrl(url: string, userId: string): boolean {
  if (!isAllowedUploadUrl(url, userId)) return false;
  const path = url.split("?")[0] ?? url;
  return PROFILE_IMAGE_EXT.test(path);
}

export const userRouter = router({
  // Get current user profile
  getProfile: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/user/me",
        tags: ["user"],
        summary: "Get current user profile",
      },
    })
    .input(z.void())
    .output(
      z.object({
        id: z.string(),
        name: z.string().nullable().optional(),
        email: z.string().email(),
        phone: z.string().nullable().optional(),
        image: z.string().nullable().optional(),
        role: z.string(),
        createdAt: z.date(),
        providerProfile: z
          .object({
            bio: z.string().nullable().optional(),
            portfolio: z.string().url().nullable().optional(),
            skillsTags: z.array(z.string()).nullable().optional(),
            isActive: z.boolean().nullable().optional(),
          })
          .nullable()
          .optional(),
      })
    )
    .query(async ({ ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          role: true,
          createdAt: true,
          providerProfile: {
            select: {
              bio: true,
              portfolio: true,
              skillsTags: true,
              isActive: true,
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

      return user;
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/user/me",
        tags: ["user"],
        summary: "Update current user profile",
      },
    })
    .input(
      z.object({
        name: z.string().min(1).optional(),
        email: z.string().email("Invalid email address").toLowerCase().optional(),
        phone: phoneWithCountryCodeSchema,
        image: z.string().min(1, "Invalid image URL").optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        user: z.object({
          id: z.string(),
          name: z.string().nullable().optional(),
          email: z.string().email(),
          phone: z.string().nullable().optional(),
          image: z.string().nullable().optional(),
          role: z.string(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const existingUser = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (input.image !== undefined && !isOwnProfileImageUrl(input.image, userId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid image URL",
        });
      }

      let nextEmail: string | undefined;
      // If email is being changed, check if it's already taken
      if (input.email) {
        nextEmail = input.email.toLowerCase().trim();
        const conflictingUser = await ctx.db.user.findFirst({
          where: {
            email: nextEmail,
            id: { not: userId },
          },
        });

        if (conflictingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email already in use by another account",
          });
        }
      }

      const emailChanged = !!nextEmail && nextEmail !== existingUser.email.toLowerCase().trim();

      const updatedUser = await ctx.db.user.update({
        where: { id: userId },
        data: {
          ...(input.name && { name: input.name }),
          ...(nextEmail && { email: nextEmail }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.image !== undefined && { image: input.image }),
          preferredLocale: normalizeAppLocale(ctx.locale),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          role: true,
        },
      });

      if (emailChanged && nextEmail) {
        await notifyEmailChanged({
          userId,
          userName: updatedUser.name || existingUser.name || nextEmail,
          oldEmail: existingUser.email,
          newEmail: nextEmail,
          locale: ctx.locale,
        });
      }

      return {
        success: true,
        message: "Profile updated successfully",
        user: updatedUser,
      };
    }),

  // Update provider profile (bio, portfolio, skills)
  updateProviderProfile: protectedProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/user/provider-profile",
        tags: ["user"],
        summary: "Update provider profile",
      },
    })
    .input(
      z.object({
        bio: z.string().optional(),
        portfolio: z.string().url("Invalid portfolio URL").nullable().optional(),
        skillsTags: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        profile: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Check if user is a provider
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { role: true, providerProfile: true },
      });

      if (user?.role !== "PROVIDER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only creators can update creator profiles",
        });
      }

      if (!user.providerProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Creator profile not found",
        });
      }

      const updatedProfile = await ctx.db.providerProfile.update({
        where: { userId },
        data: {
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.portfolio !== undefined && { portfolio: input.portfolio }),
          ...(input.skillsTags && { skillsTags: input.skillsTags }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });

      return {
        success: true,
        message: "Creator profile updated successfully",
        profile: updatedProfile,
      };
    }),

  // Change password
  changePassword: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/user/change-password",
        tags: ["user"],
        summary: "Change current user password",
      },
    })
    .input(
      z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: passwordSchema,
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get current user with password
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { password: true, name: true, email: true },
      });

      if (!user?.password) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found or account uses OAuth authentication",
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(input.currentPassword, user.password);

      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      // Check if new password is same as current
      const isSamePassword = await bcrypt.compare(input.newPassword, user.password);
      if (isSamePassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New password must be different from current password",
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(input.newPassword, 12);

      await persistPasswordChange(ctx.db, userId, hashedPassword);
      await invalidateSessionUserCache(userId);

      await notifyPasswordChanged({
        userId,
        userName: user.name || user.email,
        locale: ctx.locale,
      });

      logActivityAsync({
        action: "auth.password_change",
        message: "Password changed from profile",
        actorId: userId,
        actorRole: ctx.session.user.role,
        entityType: "User",
        entityId: userId,
      });

      return {
        success: true,
        message: "Password changed successfully. Please sign in again.",
      };
    }),

  // Delete account
  deleteAccount: protectedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/user/account",
        tags: ["user"],
        summary: "Delete current user account",
      },
    })
    .input(
      z.object({
        password: z.string().min(1, "Password is required"),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get current user with password
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { password: true, email: true, name: true },
      });

      if (!user?.password) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found or account uses OAuth authentication",
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(input.password, user.password);

      if (!isValidPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Password is incorrect",
        });
      }

      // Farewell before rewriting the email on soft-delete.
      await sendAccountDeletedEmail({
        userEmail: user.email,
        userName: user.name || user.email,
        locale: ctx.locale,
      });

      // Soft delete user
      await ctx.db.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: `deleted_${userId}@deleted.com`, // Prevent email conflicts
          sessions: { deleteMany: {} },
          accounts: { deleteMany: {} },
        },
      });

      return {
        success: true,
        message: "Account deleted successfully",
      };
    }),
});
