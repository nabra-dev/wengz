import { z } from "zod";
import bcrypt from "bcryptjs";
import { router, protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { phoneWithCountryCodeSchema } from "@/lib/validations";

const DEFAULT_AVATAR = "/images/logo.svg";

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

      return {
        ...user,
        image: user.role === "CLIENT" ? user.image : DEFAULT_AVATAR,
      };
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
        name: z.string().min(2, "Name must be at least 2 characters").optional(),
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
        select: { role: true, image: true },
      });

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const isClient = existingUser.role === "CLIENT";

      // If email is being changed, check if it's already taken
      if (input.email) {
        const normalizedEmail = input.email.toLowerCase().trim();
        const conflictingUser = await ctx.db.user.findFirst({
          where: {
            email: normalizedEmail,
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

      const updatedUser = await ctx.db.user.update({
        where: { id: userId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.email && { email: input.email }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(isClient && input.image !== undefined && { image: input.image }),
          ...(!isClient && { image: DEFAULT_AVATAR }),
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

      return {
        success: true,
        message: "Profile updated successfully",
        user: {
          ...updatedUser,
          image: isClient ? updatedUser.image : DEFAULT_AVATAR,
        },
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
        bio: z.string().max(1000, "Bio must be less than 1000 characters").optional(),
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
          message: "Only providers can update provider profiles",
        });
      }

      if (!user.providerProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Provider profile not found",
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
        message: "Provider profile updated successfully",
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
        newPassword: z.string().min(6, "New password must be at least 6 characters"),
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
        select: { password: true },
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

      // Update password
      await ctx.db.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      return {
        success: true,
        message: "Password changed successfully",
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
        select: { password: true },
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

      // Soft delete user
      await ctx.db.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          email: `deleted_${userId}@deleted.com`, // Prevent email conflicts
        },
      });

      return {
        success: true,
        message: "Account deleted successfully",
      };
    }),
});
