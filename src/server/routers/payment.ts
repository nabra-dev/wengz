import { z } from "zod";
import { router, protectedProcedure, clientProcedure, adminProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { PaymentStatus } from "@prisma/client";
import { createNotification, notifyAdminsNewPendingPayment } from "@/lib/notifications";
import { getTranslation } from "@/lib/notifications/i18n-helper";
import { resolveLocalizedText } from "@/lib/i18n";
import { logActivityAsync } from "@/lib/activity-log";
import {
  buildClientPaymentMethods,
  getPaymentSettings,
} from "@/lib/payment-settings";

export const paymentRouter = router({
  // Get IBAN info for payment (public info clients need)
  getPaymentInfo: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/payment/info",
        tags: ["payment"],
        summary: "Get payment info",
      },
    })
    .output(
      z.object({
        bankName: z.string(),
        accountName: z.string(),
        iban: z.string(),
        swiftCode: z.string(),
        currency: z.string(),
        note: z.string(),
        instapayEnabled: z.boolean(),
        instapayLink: z.string().optional(),
        methods: z.array(
          z.object({
            id: z.enum([
              "bank_transfer",
              "instapay",
              "fawry",
              "meeza",
              "visa",
              "mastercard",
            ]),
            category: z.enum(["manual", "local", "international"]),
            available: z.boolean(),
            comingSoon: z.boolean(),
          })
        ),
      })
    )
    .query(async ({ ctx }) => {
      const settings = await getPaymentSettings(ctx.db);
      const methods = buildClientPaymentMethods(settings);

      return {
        bankName: settings.bankName,
        accountName: settings.accountName,
        iban: settings.iban,
        swiftCode: settings.swiftCode,
        currency: settings.currency,
        note: settings.note,
        instapayEnabled: settings.instapayEnabled,
        instapayLink: settings.instapayEnabled ? settings.instapayLink : undefined,
        methods,
      };
    }),

  // Client submits payment proof
  submitProof: clientProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/payment/submit-proof",
        tags: ["payment"],
        summary: "Submit payment proof",
      },
    })
    .input(
      z.object({
        subscriptionId: z.string(),
        transferImage: z.string().min(1, "Transfer image is required"),
        senderName: z.string().min(2),
        senderBank: z.string().min(2),
        senderCountry: z.string().min(2),
        amount: z.number().positive(),
        currency: z.literal("USD").default("USD"),
        transferDate: z.date(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .output(z.any())
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify the subscription belongs to this user
      const subscription = await ctx.db.clientSubscription.findFirst({
        where: {
          id: input.subscriptionId,
          userId,
        },
        include: {
          paymentProof: true,
        },
      });

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      if (subscription.paymentProof) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Payment proof already submitted for this subscription",
        });
      }

      // Create payment proof
      const paymentProof = await ctx.db.paymentProof.create({
        data: {
          subscriptionId: input.subscriptionId,
          userId,
          transferImage: input.transferImage,
          senderName: input.senderName,
          senderBank: input.senderBank,
          senderCountry: input.senderCountry,
          amount: input.amount,
          currency: "USD",
          transferDate: input.transferDate,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          status: PaymentStatus.PENDING,
        },
      });

      // Notify admins (DB + SSE)
      await notifyAdminsNewPendingPayment({
        clientNameOrEmail: ctx.session.user.name || ctx.session.user.email || "Unknown",
        amount: input.amount,
        currency: input.currency,
        locale: ctx.locale,
      });

      return paymentProof;
    }),

  // Get payment proof for a subscription (client)
  getMyPaymentProof: clientProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/payment/my-proof",
        tags: ["payment"],
        summary: "Get my payment proof",
      },
    })
    .input(z.object({ subscriptionId: z.string() }))
    .output(z.any())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      return ctx.db.paymentProof.findFirst({
        where: {
          subscriptionId: input.subscriptionId,
          userId,
        },
      });
    }),

  // Get all pending payments (admin)
  getPendingPayments: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/payment/pending",
        tags: ["payment"],
        summary: "List pending payments (admin)",
      },
    })
    .output(z.array(z.any()))
    .query(async ({ ctx }) => {
      return ctx.db.paymentProof.findMany({
        where: {
          status: PaymentStatus.PENDING,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          subscription: {
            include: {
              package: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Get all payments with filters (admin)
  getAllPayments: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/payment",
        tags: ["payment"],
        summary: "List payments (admin)",
      },
    })
    .input(
      z.object({
        status: z.nativeEnum(PaymentStatus).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .output(z.object({ payments: z.array(z.any()), nextCursor: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      const payments = await ctx.db.paymentProof.findMany({
        where: input.status ? { status: input.status } : undefined,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          subscription: {
            include: {
              package: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: typeof input.cursor | undefined = undefined;
      if (payments.length > input.limit) {
        const nextItem = payments.pop();
        nextCursor = nextItem!.id;
      }

      return {
        payments,
        nextCursor: nextCursor ?? null,
      };
    }),

  // Approve payment (admin)
  approvePayment: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/payment/approve",
        tags: ["payment"],
        summary: "Approve payment (admin)",
      },
    })
    .input(z.object({ paymentId: z.string() }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const adminId = ctx.session.user.id;

      const payment = await ctx.db.paymentProof.findUnique({
        where: { id: input.paymentId },
        include: {
          subscription: {
            include: {
              package: true,
            },
          },
          user: true,
        },
      });

      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment proof not found",
        });
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This payment has already been reviewed",
        });
      }

      // Soft amount check: warn/block if submitted amount is far below package price
      // (allow small rounding differences of 1%).
      const packagePrice = payment.subscription.package.price;
      if (packagePrice > 0 && payment.amount < packagePrice * 0.99) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Payment amount (${payment.amount}) is below package price (${packagePrice}). Reject or ask client to resubmit.`,
        });
      }

      // Single transaction: CAS the proof status, deactivate any other active
      // subscriptions for this user, then activate the paid one. Concurrent
      // approvals collapse to one winner; partial failures roll back.
      await ctx.db.$transaction(async (tx) => {
        const cas = await tx.paymentProof.updateMany({
          where: { id: input.paymentId, status: PaymentStatus.PENDING },
          data: {
            status: PaymentStatus.APPROVED,
            reviewedBy: adminId,
            reviewedAt: new Date(),
          },
        });

        if (cas.count === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This payment has already been reviewed",
          });
        }

        // Enforce a single active subscription per client.
        await tx.clientSubscription.updateMany({
          where: {
            userId: payment.userId,
            isActive: true,
            id: { not: payment.subscriptionId },
          },
          data: { isActive: false },
        });

        // Activate the subscription
        await tx.clientSubscription.update({
          where: { id: payment.subscriptionId },
          data: {
            isActive: true,
            startDate: new Date(),
            endDate: new Date(
              Date.now() + payment.subscription.package.durationDays * 24 * 60 * 60 * 1000
            ),
          },
        });
      });

      // Notify the user (DB + SSE)
      const localizedPackageName = resolveLocalizedText(
        payment.subscription.package.nameI18n as Record<string, string> | null,
        ctx.locale,
        payment.subscription.package.name
      );
      const approvedTitle = await getTranslation(ctx.locale, "notifications.paymentApproved.title");
      const approvedMessage = await getTranslation(
        ctx.locale,
        "notifications.paymentApproved.message",
        {
          packageName: localizedPackageName,
        }
      );
      await createNotification({
        userId: payment.userId,
        title: approvedTitle,
        message: approvedMessage,
        type: "general",
        link: "/client/subscription",
        sendEmail: false,
        locale: ctx.locale,
        sseI18n: {
          titleKey: "notifications.paymentApproved.title",
          messageKey: "notifications.paymentApproved.message",
          messageParams: { packageName: localizedPackageName },
        },
      });

      logActivityAsync({
        action: "payment.approve",
        message: `Payment approved for ${payment.userId}`,
        actorId: adminId,
        actorRole: "SUPER_ADMIN",
        entityType: "PaymentProof",
        entityId: payment.id,
        metadata: {
          subscriptionId: payment.subscriptionId,
          amount: payment.amount,
          currency: payment.currency,
        },
      });

      return { success: true };
    }),

  // Reject payment (admin)
  rejectPayment: adminProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/payment/reject",
        tags: ["payment"],
        summary: "Reject payment (admin)",
      },
    })
    .input(
      z.object({
        paymentId: z.string(),
        reason: z.string().min(10, "Please provide a detailed reason for rejection"),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const adminId = ctx.session.user.id;

      const payment = await ctx.db.paymentProof.findUnique({
        where: { id: input.paymentId },
        include: {
          subscription: {
            include: {
              package: true,
            },
          },
          user: true,
        },
      });

      if (!payment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment proof not found",
        });
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This payment has already been reviewed",
        });
      }

      // Single transaction with a CAS on PENDING so concurrent reviews
      // collapse to one winner and partial failures roll back.
      await ctx.db.$transaction(async (tx) => {
        const cas = await tx.paymentProof.updateMany({
          where: { id: input.paymentId, status: PaymentStatus.PENDING },
          data: {
            status: PaymentStatus.REJECTED,
            reviewedBy: adminId,
            reviewedAt: new Date(),
            rejectionReason: input.reason,
          },
        });

        if (cas.count === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This payment has already been reviewed",
          });
        }

        // Deactivate the subscription (it was pending anyway)
        await tx.clientSubscription.update({
          where: { id: payment.subscriptionId },
          data: {
            isActive: false,
            cancelledAt: new Date(),
          },
        });
      });

      // Notify the user (DB + SSE)
      const rejectedTitle = await getTranslation(ctx.locale, "notifications.paymentRejected.title");
      const rejectedMessage = await getTranslation(
        ctx.locale,
        "notifications.paymentRejected.message",
        {
          reason: input.reason,
        }
      );
      await createNotification({
        userId: payment.userId,
        title: rejectedTitle,
        message: rejectedMessage,
        type: "general",
        link: "/client/subscription",
        sendEmail: false,
        locale: ctx.locale,
        sseI18n: {
          titleKey: "notifications.paymentRejected.title",
          messageKey: "notifications.paymentRejected.message",
          messageParams: { reason: input.reason },
        },
      });

      logActivityAsync({
        action: "payment.reject",
        message: `Payment rejected for ${payment.userId}`,
        actorId: adminId,
        actorRole: "SUPER_ADMIN",
        entityType: "PaymentProof",
        entityId: payment.id,
        level: "warn",
        metadata: {
          subscriptionId: payment.subscriptionId,
          reason: input.reason,
        },
      });

      return { success: true };
    }),

  // Get payment stats for admin dashboard
  getStats: adminProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/payment/stats",
        tags: ["payment"],
        summary: "Get payment stats (admin)",
      },
    })
    .output(
      z.object({
        pending: z.number(),
        approved: z.number(),
        rejected: z.number(),
        total: z.number(),
      })
    )
    .query(async ({ ctx }) => {
      const [pending, approved, rejected, total] = await Promise.all([
        ctx.db.paymentProof.count({ where: { status: PaymentStatus.PENDING } }),
        ctx.db.paymentProof.count({ where: { status: PaymentStatus.APPROVED } }),
        ctx.db.paymentProof.count({ where: { status: PaymentStatus.REJECTED } }),
        ctx.db.paymentProof.count(),
      ]);

      return { pending, approved, rejected, total };
    }),
});
