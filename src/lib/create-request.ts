import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { checkAndDeductCredits } from "@/lib/credit-logic";
import { invalidateSubscriptionCache } from "@/lib/cache-invalidation";
import {
  validateAttributeResponses,
  calculateAttributeCredits,
  collectAttributeMediaUrls,
} from "@/lib/attribute-validation";
import { assertAllowedUploadUrls } from "@/lib/upload-url";
import {
  createNotification,
  notifyNewRequestAvailable,
  notifyProviderAssignment,
} from "@/lib/notifications";
import { getTranslation } from "@/lib/notifications/i18n-helper";
import { logRequestActivity } from "@/lib/request-activity";
import { collectAttributeTextAnswers } from "@/lib/contact-leak";
import { enforceNoContactLeakInFields } from "@/lib/contact-leak-enforce";
import type { ServiceAttribute, AttributeResponse } from "@/types/service-attributes";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type CreateServiceRequestInput = {
  db: PrismaClient;
  clientId: string;
  actorId: string;
  actorRole: string;
  locale: string;
  title: string;
  description: string;
  serviceTypeId: string;
  formData?: Record<string, unknown>;
  attributeResponses?: unknown;
  attachments?: string[];
  /** Optional provider to assign at creation (keeps status PENDING). */
  providerId?: string | null;
  /**
   * User whose upload namespace owns attachment/attribute file URLs.
   * Client create: same as clientId. Admin create: the staff user uploading.
   */
  uploaderUserId: string;
  /** When true, error copy refers to the client rather than "you". */
  createdByStaff?: boolean;
};

export type CreateServiceRequestResult = {
  success: true;
  request: Prisma.RequestGetPayload<{ include: { serviceType: true } }>;
  creditsRemaining: number;
  message: string;
};

/**
 * Validates that the client's subscription package allows access to the service.
 */
export async function validateServiceAccess(
  db: DbClient,
  userId: string,
  serviceTypeId: string,
  serviceName: string,
  options?: { createdByStaff?: boolean }
) {
  const activeSubscription = await db.clientSubscription.findFirst({
    where: {
      userId,
      isActive: true,
      endDate: { gte: new Date() },
    },
    include: {
      package: {
        include: {
          services: true,
        },
      },
    },
  });

  if (!activeSubscription) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: options?.createdByStaff
        ? "This client has no active subscription. They must subscribe before a request can be created."
        : "No active subscription found. Please subscribe to a package to create requests.",
    });
  }

  const hasAllServicesSupport = Boolean(
    (activeSubscription.package as { supportAllServices?: boolean }).supportAllServices
  );
  if (!hasAllServicesSupport) {
    const allowedServiceIds = activeSubscription.package.services.map(
      (s: { serviceId: string }) => s.serviceId
    );
    if (!allowedServiceIds.includes(serviceTypeId)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: options?.createdByStaff
          ? `The client's ${activeSubscription.package.name} package does not include ${serviceName}.`
          : `Your ${activeSubscription.package.name} package does not include ${serviceName} service. Please upgrade your subscription to access this service.`,
      });
    }
  }
}

/**
 * Validates attribute responses against service type attributes.
 */
export function validateServiceAttributes(
  serviceType: { attributes?: unknown },
  attributeResponses: unknown,
  uploaderUserId: string
) {
  if (serviceType.attributes && attributeResponses) {
    const validation = validateAttributeResponses(
      serviceType.attributes as ServiceAttribute[],
      attributeResponses as AttributeResponse[],
      { userId: uploaderUserId }
    );

    if (!validation.valid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid attribute responses: ${validation.errors.join(", ")}`,
      });
    }

    try {
      assertAllowedUploadUrls(
        collectAttributeMediaUrls(
          serviceType.attributes as ServiceAttribute[],
          attributeResponses as AttributeResponse[]
        ),
        uploaderUserId
      );
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid attribute file URL. Upload files through the app first.",
      });
    }
  }
}

/**
 * Calculates total credit cost including base and attributes.
 */
export function calculateTotalCreditCost(
  serviceType: { creditCost?: number | null; attributes?: unknown },
  attributeResponses: unknown
) {
  const baseCreditCost = serviceType.creditCost || 1;

  const attributeCredits =
    serviceType.attributes && attributeResponses
      ? calculateAttributeCredits(
          serviceType.attributes as ServiceAttribute[],
          attributeResponses as AttributeResponse[]
        )
      : 0;

  return {
    baseCreditCost,
    attributeCredits,
    totalCreditCost: baseCreditCost + attributeCredits,
  };
}

/**
 * Notifies providers who support the requested service type.
 */
export async function notifyMatchingProviders(
  db: DbClient,
  serviceTypeId: string,
  serviceName: string,
  requestTitle: string,
  requestId: string,
  locale: string
) {
  const providersWithService = await db.providerProfile.findMany({
    where: {
      isActive: true,
      supportedServices: {
        some: {
          id: serviceTypeId,
        },
      },
    },
    select: {
      userId: true,
    },
  });

  if (providersWithService.length === 0) return;

  await Promise.all(
    providersWithService.map((provider: { userId: string }) =>
      notifyNewRequestAvailable({
        providerId: provider.userId,
        requestId,
        serviceName,
        requestTitle,
        locale,
      })
    )
  );
}

/**
 * Builds cost breakdown message for the response.
 */
export function buildCostBreakdownMessage(
  baseCreditCost: number,
  attributeCredits: number,
  totalCreditCost: number
): string {
  const costBreakdown = [];
  costBreakdown.push(`Base: ${baseCreditCost}`);
  if (attributeCredits > 0) {
    costBreakdown.push(`Attributes: ${attributeCredits}`);
  }
  const breakdownMessage = costBreakdown.length > 1 ? ` (${costBreakdown.join(" + ")})` : "";

  return `Request created successfully. ${totalCreditCost} credit${totalCreditCost === 1 ? "" : "s"} ${totalCreditCost === 1 ? "has" : "have"} been deducted${breakdownMessage}.`;
}

async function assertValidClient(db: DbClient, clientId: string) {
  const client = await db.user.findFirst({
    where: {
      id: clientId,
      role: "CLIENT",
      deletedAt: null,
      approvalStatus: "APPROVED",
    },
    select: { id: true, name: true, email: true },
  });

  if (!client) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Client not found, inactive, or not approved",
    });
  }

  return client;
}

async function assertValidProvider(
  db: DbClient,
  providerId: string,
  serviceTypeId: string
): Promise<{ id: string; name: string | null; email: string }> {
  const provider = await db.user.findFirst({
    where: {
      id: providerId,
      role: "PROVIDER",
      deletedAt: null,
      approvalStatus: "APPROVED",
    },
    select: {
      id: true,
      name: true,
      email: true,
      providerProfile: {
        select: {
          isActive: true,
          supportedServices: { select: { id: true } },
        },
      },
    },
  });

  if (!provider) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Creator not found, inactive, or not approved",
    });
  }

  if (!provider.providerProfile?.isActive) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Creator profile is inactive",
    });
  }

  const supportsService = provider.providerProfile.supportedServices.some(
    (s) => s.id === serviceTypeId
  );
  if (!supportsService) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Creator does not support this service type",
    });
  }

  return { id: provider.id, name: provider.name, email: provider.email };
}

/**
 * Shared request creation: validates client, package access, attributes, uploads,
 * deducts the client's credits, and creates the request (+ optional provider).
 */
export async function createServiceRequest(
  input: CreateServiceRequestInput
): Promise<CreateServiceRequestResult> {
  const {
    db,
    clientId,
    actorId,
    actorRole,
    locale,
    title,
    description,
    serviceTypeId,
    formData,
    attributeResponses,
    attachments,
    providerId,
    uploaderUserId,
    createdByStaff = false,
  } = input;

  await assertValidClient(db, clientId);

  const serviceType = await db.serviceType.findFirst({
    where: { id: serviceTypeId, isActive: true, deletedAt: null },
  });

  if (!serviceType) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Service type not found or inactive",
    });
  }

  await validateServiceAccess(db, clientId, serviceTypeId, serviceType.name, {
    createdByStaff,
  });

  validateServiceAttributes(serviceType, attributeResponses, uploaderUserId);

  await enforceNoContactLeakInFields(
    {
      title,
      description,
      attributeAnswers: collectAttributeTextAnswers(attributeResponses),
    },
    {
      locale,
      actorId,
      actorRole,
      field: "create_request",
    }
  );

  try {
    assertAllowedUploadUrls(attachments, uploaderUserId);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid attachment URL. Upload files through the app first.",
    });
  }

  let provider: { id: string; name: string | null; email: string } | null = null;
  if (providerId) {
    provider = await assertValidProvider(db, providerId, serviceTypeId);
  }

  const costDetails = calculateTotalCreditCost(serviceType, attributeResponses);

  const requestCreatedComment = await getTranslation(
    locale,
    "requests.messages.systemMessages.requestCreated"
  );

  const creditReason = createdByStaff ? `Admin-created request: ${title}` : `New request: ${title}`;

  const { request, creditResult } = await db.$transaction(async (tx) => {
    const creditResult = await checkAndDeductCredits(
      clientId,
      costDetails.totalCreditCost,
      creditReason,
      tx
    );

    if (!creditResult.allowed || !creditResult.success) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: creditResult.message,
      });
    }

    const request = await tx.request.create({
      data: {
        title,
        description,
        clientId,
        providerId: provider?.id ?? null,
        serviceTypeId,
        creditCost: costDetails.totalCreditCost,
        baseCreditCost: costDetails.baseCreditCost,
        attributeCredits: costDetails.attributeCredits,
        priorityCreditCost: 0,
        isRevision: false,
        formData: formData || {},
        attributeResponses: attributeResponses || null,
        attachments: attachments || [],
        status: "PENDING",
      } as Prisma.RequestUncheckedCreateInput,
      include: {
        serviceType: true,
      },
    });

    await tx.requestComment.create({
      data: {
        requestId: request.id,
        userId: actorId,
        content: requestCreatedComment,
        type: "SYSTEM",
      },
    });

    return { request, creditResult };
  });

  await invalidateSubscriptionCache(clientId);

  logRequestActivity({
    action: "request.create",
    requestId: request.id,
    actorId,
    actorRole,
    message: createdByStaff
      ? `Request created for client ${clientId}: ${title}`
      : `Request created: ${title}`,
    metadata: {
      title,
      serviceTypeId,
      clientId,
      providerId: provider?.id ?? null,
      creditCost: costDetails.totalCreditCost,
      attachmentCount: attachments?.length ?? 0,
      createdByStaff,
    },
  });

  // Notify matching providers only when unassigned; assigned providers get assignment notice.
  if (provider) {
    await notifyProviderAssignment({
      requestId: request.id,
      providerId: provider.id,
      providerName: provider.name || provider.email,
    });
  } else {
    await notifyMatchingProviders(db, serviceTypeId, serviceType.name, title, request.id, locale);
  }

  if (createdByStaff) {
    const notifTitle = await getTranslation(locale, "notifications.requestCreatedByAdmin.title");
    const notifMessage = await getTranslation(
      locale,
      "notifications.requestCreatedByAdmin.message",
      { requestTitle: title }
    );
    await createNotification({
      userId: clientId,
      title: notifTitle,
      message: notifMessage,
      type: "general",
      link: `/client/requests/${request.id}`,
      requestId: request.id,
      sendEmail: false,
      locale,
      sseI18n: {
        titleKey: "notifications.requestCreatedByAdmin.title",
        messageKey: "notifications.requestCreatedByAdmin.message",
        messageParams: { requestTitle: title },
      },
    });
  }

  const message = buildCostBreakdownMessage(
    costDetails.baseCreditCost,
    costDetails.attributeCredits,
    costDetails.totalCreditCost
  );

  return {
    success: true,
    request,
    creditsRemaining: creditResult.newBalance,
    message,
  };
}
