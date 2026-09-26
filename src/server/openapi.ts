import { generateOpenApiDocument } from "trpc-to-openapi";
import { appRouter } from "./routers/_app";
import { logger } from "@/lib/logger";

export function buildOpenApiDocument(baseUrl: string) {
  try {
    return generateOpenApiDocument(appRouter, {
      title: "Wengz API",
      description: "REST API for Wengz - A credit-based digital services marketplace",
      version: "1.0.0",
      baseUrl,
      tags: [
        "auth",
        "user",
        "request",
        "provider",
        "admin",
        "subscription",
        "package",
        "payment",
        "notification",
      ],
    });
  } catch (e) {
    // Log and fall back to a static OpenAPI spec
    logger.error("buildOpenApiDocument: generation failed, using fallback spec", e);
    return {
      openapi: "3.0.3",
      info: {
        title: "Wengz API",
        description: "Fallback OpenAPI spec. Generated without trpc-to-openapi due to an error.",
        version: "1.0.0",
      },
      servers: [{ url: baseUrl }],
      tags: [
        { name: "auth" },
        { name: "user" },
        { name: "request" },
        { name: "provider" },
        { name: "admin" },
        { name: "subscription" },
        { name: "package" },
        { name: "payment" },
        { name: "notification" },
      ],
      paths: {
        "/auth/register": {
          post: {
            tags: ["auth"],
            summary: "Register a new user",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RegisterRequest" },
                  example: {
                    name: "Jane Doe",
                    email: "jane@example.com",
                    password: "StrongP@ssw0rd",
                    phone: "+1-555-1234",
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Registration successful",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/RegisterResponse" },
                    example: {
                      success: true,
                      message: "Account created successfully",
                      userId: "usr_123",
                    },
                  },
                },
              },
              "409": { description: "Email already registered" },
            },
          },
        },
        "/auth/session": {
          get: {
            tags: ["auth"],
            summary: "Get current session",
            responses: {
              "200": {
                description: "Current session",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Session" },
                    example: {
                      user: {
                        id: "usr_123",
                        name: "Jane Doe",
                        email: "jane@example.com",
                        role: "CLIENT",
                        image: null,
                      },
                    },
                  },
                },
              },
              "401": { description: "Not authenticated" },
            },
          },
        },
        "/auth/profile": {
          get: {
            tags: ["auth"],
            summary: "Get current user profile",
            responses: {
              "200": {
                description: "User profile",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/User" },
                    example: {
                      id: "usr_123",
                      name: "Jane Doe",
                      email: "jane@example.com",
                      role: "CLIENT",
                      image: null,
                      createdAt: "2025-12-18T12:00:00Z",
                      providerProfile: null,
                    },
                  },
                },
              },
            },
          },
          put: {
            tags: ["auth"],
            summary: "Update current user profile",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UpdateProfileRequest" },
                  example: { name: "Jane D.", image: "https://cdn.example.com/jane.png" },
                },
              },
            },
            responses: {
              "200": {
                description: "Profile updated",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/UpdateProfileResponse" },
                    example: {
                      success: true,
                      user: {
                        id: "usr_123",
                        name: "Jane D.",
                        email: "jane@example.com",
                        image: "https://cdn.example.com/jane.png",
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "/auth/change-password": {
          post: {
            tags: ["auth"],
            summary: "Change current user password",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ChangePasswordRequest" },
                  example: { currentPassword: "oldpass", newPassword: "StrongP@ssw0rd" },
                },
              },
            },
            responses: {
              "200": {
                description: "Password changed",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccess" },
                    example: { success: true, message: "Password changed successfully" },
                  },
                },
              },
              "401": { description: "Invalid current password" },
            },
          },
        },
        "/user/me": {
          get: {
            tags: ["user"],
            summary: "Get current user profile",
            responses: {
              "200": {
                description: "User profile",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          put: {
            tags: ["user"],
            summary: "Update current user profile",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UpdateUserRequest" },
                  example: { name: "Jane Doe", phone: "+1-555-1234" },
                },
              },
            },
            responses: {
              "200": {
                description: "Profile updated",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/UpdateUserResponse" },
                  },
                },
              },
            },
          },
        },
        "/user/provider-profile": {
          put: {
            tags: ["user"],
            summary: "Update provider profile",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UpdateProviderProfileRequest" },
                  example: {
                    bio: "Designer",
                    portfolio: "https://portfolio.example.com",
                    skillsTags: ["logo", "ui"],
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Provider profile updated",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccessWithProfile" },
                  },
                },
              },
            },
          },
        },
        "/user/change-password": {
          post: {
            tags: ["user"],
            summary: "Change current user password",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ChangePasswordRequest" },
                },
              },
            },
            responses: {
              "200": {
                description: "Password changed",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/BasicSuccess" } },
                },
              },
            },
          },
        },
        "/user/account": {
          delete: {
            tags: ["user"],
            summary: "Delete current user account",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DeleteAccountRequest" },
                  example: { password: "StrongP@ssw0rd" },
                },
              },
            },
            responses: {
              "200": {
                description: "Account deleted",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/BasicSuccess" } },
                },
              },
              "401": { description: "Invalid password" },
            },
          },
        },
        "/request": {
          post: {
            tags: ["request"],
            summary: "Create a new service request",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CreateRequest" },
                  example: {
                    title: "Logo Design",
                    description: "Need a modern logo",
                    serviceTypeId: "svc_logo",
                    priority: 2,
                    attachments: ["https://cdn.example.com/brief.pdf"],
                  },
                },
              },
            },
            responses: {
              "200": {
                description: "Request created",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/CreateRequestResponse" },
                  },
                },
              },
            },
          },
        },
        "/request/list": {
          get: {
            tags: ["request"],
            summary: "List requests for current user",
            parameters: [
              { name: "status", in: "query", schema: { type: "string" } },
              { name: "limit", in: "query", schema: { type: "integer" } },
              { name: "cursor", in: "query", schema: { type: "string" } },
            ],
            responses: {
              "200": {
                description: "Requests list",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/RequestListResponse" },
                  },
                },
              },
            },
          },
        },
        "/request/{id}": {
          get: {
            tags: ["request"],
            summary: "Get request by ID",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: {
              "200": {
                description: "Request",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Request" },
                  },
                },
              },
              "404": { description: "Not found" },
            },
          },
        },
        // Provider
        "/provider/profile": {
          get: {
            tags: ["provider"],
            summary: "Get provider profile",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/ProviderProfile" } },
                },
              },
            },
          },
          put: {
            tags: ["provider"],
            summary: "Update provider profile",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UpdateProviderProfileRequest" },
                },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccessWithProfile" },
                  },
                },
              },
            },
          },
        },
        "/provider/stats": {
          get: {
            tags: ["provider"],
            summary: "Get provider stats",
            responses: { "200": { description: "OK" } },
          },
        },
        "/provider/available-requests": {
          get: {
            tags: ["provider"],
            summary: "List available requests",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/RequestListResponse" },
                  },
                },
              },
            },
          },
        },
        "/provider/my-requests": {
          get: {
            tags: ["provider"],
            summary: "List my requests",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/RequestListResponse" },
                  },
                },
              },
            },
          },
        },
        "/provider/earnings": {
          get: {
            tags: ["provider"],
            summary: "Get earnings summary",
            responses: { "200": { description: "OK" } },
          },
        },
        "/provider/reviews": {
          get: {
            tags: ["provider"],
            summary: "List recent reviews",
            responses: { "200": { description: "OK" } },
          },
        },
        "/provider/claim-request": {
          post: {
            tags: ["provider"],
            summary: "Claim a request",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ClaimRequest" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccessWithRequest" },
                  },
                },
              },
            },
          },
        },
        "/provider/start-work": {
          post: {
            tags: ["provider"],
            summary: "Start work",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/StartWork" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccessWithRequest" },
                  },
                },
              },
            },
          },
        },
        "/provider/deliver-work": {
          post: {
            tags: ["provider"],
            summary: "Deliver work",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/DeliverWork" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccessWithRequest" },
                  },
                },
              },
            },
          },
        },
        // Admin
        "/admin/stats": {
          get: {
            tags: ["admin"],
            summary: "Get admin stats",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/AdminStats" } },
                },
              },
            },
          },
        },
        "/admin/analytics": {
          get: {
            tags: ["admin"],
            summary: "Get analytics",
            responses: { "200": { description: "OK" } },
          },
        },
        "/admin/subscriptions": {
          get: {
            tags: ["admin"],
            summary: "List subscriptions",
            responses: { "200": { description: "OK" } },
          },
        },
        "/admin/dashboard": {
          get: {
            tags: ["admin"],
            summary: "Get dashboard stats",
            responses: { "200": { description: "OK" } },
          },
        },
        "/admin/users": {
          get: {
            tags: ["admin"],
            summary: "List users",
            responses: { "200": { description: "OK" } },
          },
        },
        // Subscription
        "/subscription/active": {
          get: {
            tags: ["subscription"],
            summary: "Get active subscription",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/Subscription" } },
                },
              },
            },
          },
        },
        "/subscription/pending": {
          get: {
            tags: ["subscription"],
            summary: "Get pending subscription",
            responses: { "200": { description: "OK" } },
          },
        },
        "/subscription/balance": {
          get: {
            tags: ["subscription"],
            summary: "Get credit balance",
            responses: { "200": { description: "OK" } },
          },
        },
        "/subscription/subscribe": {
          post: {
            tags: ["subscription"],
            summary: "Subscribe to a package",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/SubscribeRequest" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/SubscribeResponse" },
                  },
                },
              },
            },
          },
        },
        "/subscription/cancel": {
          post: {
            tags: ["subscription"],
            summary: "Cancel subscription",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/CancelSubscription" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccessWithSubscription" },
                  },
                },
              },
            },
          },
        },
        "/subscription/usage": {
          get: {
            tags: ["subscription"],
            summary: "Get usage stats",
            responses: { "200": { description: "OK" } },
          },
        },
        "/subscription/history": {
          get: {
            tags: ["subscription"],
            summary: "Get subscription history",
            responses: { "200": { description: "OK" } },
          },
        },
        "/subscription/transactions": {
          get: {
            tags: ["subscription"],
            summary: "Get transaction history",
            responses: { "200": { description: "OK" } },
          },
        },
        // Package
        "/package": {
          get: {
            tags: ["package"],
            summary: "List packages",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { type: "array", items: { $ref: "#/components/schemas/Package" } },
                  },
                },
              },
            },
          },
          post: {
            tags: ["package"],
            summary: "Create package",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/CreatePackage" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccessWithPackage" },
                  },
                },
              },
            },
          },
          put: {
            tags: ["package"],
            summary: "Update package",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/UpdatePackage" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccessWithPackage" },
                  },
                },
              },
            },
          },
        },
        "/package/{id}": {
          get: {
            tags: ["package"],
            summary: "Get package by ID",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/Package" } },
                },
              },
            },
          },
          delete: {
            tags: ["package"],
            summary: "Delete package",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BasicSuccessWithPackage" },
                  },
                },
              },
            },
          },
        },
        // Payment
        "/payment/info": {
          get: {
            tags: ["payment"],
            summary: "Get payment info",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/PaymentInfo" } },
                },
              },
            },
          },
        },
        "/payment/submit-proof": {
          post: {
            tags: ["payment"],
            summary: "Submit payment proof",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/SubmitPaymentProof" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/PaymentProof" } },
                },
              },
            },
          },
        },
        "/payment/my-proof": {
          get: {
            tags: ["payment"],
            summary: "Get my payment proof",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/PaymentProof" } },
                },
              },
            },
          },
        },
        "/payment/pending": {
          get: {
            tags: ["payment"],
            summary: "List pending payments",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { type: "array", items: { $ref: "#/components/schemas/PaymentProof" } },
                  },
                },
              },
            },
          },
        },
        "/payment": {
          get: {
            tags: ["payment"],
            summary: "List payments",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/PaymentListResponse" },
                  },
                },
              },
            },
          },
        },
        "/payment/approve": {
          post: {
            tags: ["payment"],
            summary: "Approve payment",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ApprovePayment" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/BasicSuccess" } },
                },
              },
            },
          },
        },
        "/payment/reject": {
          post: {
            tags: ["payment"],
            summary: "Reject payment",
            requestBody: {
              required: true,
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/RejectPayment" } },
              },
            },
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": { schema: { $ref: "#/components/schemas/BasicSuccess" } },
                },
              },
            },
          },
        },
        "/payment/stats": {
          get: {
            tags: ["payment"],
            summary: "Get payment stats",
            responses: { "200": { description: "OK" } },
          },
        },
        // Notification
        "/notification": {
          get: {
            tags: ["notification"],
            summary: "List notifications",
            responses: { "200": { description: "OK" } },
          },
        },
        "/notification/unread-count": {
          get: {
            tags: ["notification"],
            summary: "Unread count",
            responses: { "200": { description: "OK" } },
          },
        },
        "/notification/mark-read": {
          post: {
            tags: ["notification"],
            summary: "Mark as read",
            requestBody: { content: { "application/json": { schema: { type: "object" } } } },
            responses: { "200": { description: "OK" } },
          },
        },
        "/notification/mark-all-read": {
          post: {
            tags: ["notification"],
            summary: "Mark all as read",
            responses: { "200": { description: "OK" } },
          },
        },
        "/notification/{id}": {
          delete: {
            tags: ["notification"],
            summary: "Delete notification",
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            responses: { "200": { description: "OK" } },
          },
        },
        "/notification/read": {
          delete: {
            tags: ["notification"],
            summary: "Delete all read",
            responses: { "200": { description: "OK" } },
          },
        },
      },
      components: {
        schemas: {
          // Reusable primitives
          BasicSuccess: {
            type: "object",
            properties: { success: { type: "boolean" }, message: { type: "string" } },
            required: ["success"],
          },
          BasicSuccessWithRequest: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              request: { $ref: "#/components/schemas/Request" },
            },
            required: ["success", "request"],
          },
          BasicSuccessWithProfile: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              profile: { $ref: "#/components/schemas/ProviderProfile" },
            },
            required: ["success", "profile"],
          },
          BasicSuccessWithPackage: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              package: { $ref: "#/components/schemas/Package" },
            },
            required: ["success", "package"],
          },
          BasicSuccessWithSubscription: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              subscription: { $ref: "#/components/schemas/Subscription" },
            },
            required: ["success", "subscription"],
          },

          // Auth/User
          RegisterRequest: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string", format: "email" },
              password: { type: "string" },
              phone: { type: "string" },
            },
            required: ["name", "email", "password"],
          },
          RegisterResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              userId: { type: "string" },
            },
            required: ["success", "userId"],
          },
          Session: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } },
          User: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string", nullable: true },
              email: { type: "string", format: "email" },
              role: { type: "string" },
              image: { type: "string", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              providerProfile: {
                anyOf: [{ $ref: "#/components/schemas/ProviderProfile" }, { type: "null" }],
              },
            },
            required: ["id", "email", "role", "createdAt"],
          },
          UpdateProfileRequest: {
            type: "object",
            properties: { name: { type: "string" }, image: { type: "string", format: "uri" } },
          },
          UpdateProfileResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              user: { $ref: "#/components/schemas/User" },
            },
            required: ["success", "user"],
          },
          UpdateUserRequest: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string", format: "email" },
              image: { type: "string" },
              phone: { type: "string" },
            },
          },
          UpdateUserResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              user: { $ref: "#/components/schemas/User" },
            },
            required: ["success", "user"],
          },
          UpdateProviderProfileRequest: {
            type: "object",
            properties: {
              bio: { type: "string" },
              portfolio: { type: "string", format: "uri" },
              skillsTags: { type: "array", items: { type: "string" } },
              isActive: { type: "boolean" },
            },
          },
          ChangePasswordRequest: {
            type: "object",
            properties: { currentPassword: { type: "string" }, newPassword: { type: "string" } },
            required: ["currentPassword", "newPassword"],
          },
          DeleteAccountRequest: {
            type: "object",
            properties: { password: { type: "string" } },
            required: ["password"],
          },

          // Request
          RequestStatus: {
            type: "string",
            enum: [
              "PENDING",
              "IN_PROGRESS",
              "DELIVERED",
              "REVISION_REQUESTED",
              "COMPLETED",
              "CANCELLED",
            ],
          },
          Request: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              clientId: { type: "string" },
              providerId: { type: "string", nullable: true },
              serviceTypeId: { type: "string" },
              priority: { type: "integer" },
              creditCost: { type: "integer" },
              status: { $ref: "#/components/schemas/RequestStatus" },
              createdAt: { type: "string", format: "date-time" },
            },
            required: [
              "id",
              "title",
              "description",
              "clientId",
              "serviceTypeId",
              "priority",
              "creditCost",
              "status",
              "createdAt",
            ],
          },
          CreateRequest: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              serviceTypeId: { type: "string" },
              priority: { type: "integer" },
              formData: { type: "object" },
              attributeResponses: { type: "array", items: { type: "object" } },
              attachments: { type: "array", items: { type: "string" } },
            },
            required: ["serviceTypeId"],
          },
          CreateRequestResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              request: { $ref: "#/components/schemas/Request" },
              creditsRemaining: { type: "integer" },
              message: { type: "string" },
            },
            required: ["success", "request"],
          },
          RequestListResponse: {
            type: "object",
            properties: {
              requests: { type: "array", items: { $ref: "#/components/schemas/Request" } },
              nextCursor: { type: "string", nullable: true },
            },
            required: ["requests"],
          },
          ClaimRequest: {
            type: "object",
            properties: { requestId: { type: "string" } },
            required: ["requestId"],
          },
          StartWork: {
            type: "object",
            properties: {
              requestId: { type: "string" },
              estimatedDeliveryMinutes: {
                type: "integer",
                minimum: 15,
                description:
                  "Estimated delivery time in minutes. Maximum is the service's maxDeliveryMinutes setting.",
              },
            },
            required: ["requestId", "estimatedDeliveryMinutes"],
          },
          DeliverWork: {
            type: "object",
            properties: {
              requestId: { type: "string" },
              deliverableMessage: { type: "string" },
              files: { type: "array", items: { type: "string" } },
            },
            required: ["requestId", "deliverableMessage"],
          },

          // Subscription/Package
          Subscription: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              packageId: { type: "string" },
              remainingCredits: { type: "integer" },
              startDate: { type: "string", format: "date-time" },
              endDate: { type: "string", format: "date-time" },
              isActive: { type: "boolean" },
              isExpiring: { type: "boolean" },
              daysRemaining: { type: "integer" },
              package: { $ref: "#/components/schemas/Package" },
            },
          },
          SubscribeRequest: {
            type: "object",
            properties: { packageId: { type: "string" } },
            required: ["packageId"],
          },
          SubscribeResponse: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              subscription: { $ref: "#/components/schemas/Subscription" },
              requiresPayment: { type: "boolean" },
              message: { type: "string" },
            },
            required: ["success", "subscription"],
          },
          CancelSubscription: {
            type: "object",
            properties: { subscriptionId: { type: "string" } },
            required: ["subscriptionId"],
          },
          Package: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              price: { type: "number" },
              credits: { type: "integer" },
              durationDays: { type: "integer" },
              features: { type: "array", items: { type: "string" } },
              isActive: { type: "boolean" },
              isFeatured: { type: "boolean" },
            },
          },
          CreatePackage: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              credits: { type: "integer" },
              price: { type: "number" },
              durationDays: { type: "integer" },
              features: { type: "array", items: { type: "string" } },
              sortOrder: { type: "integer" },
              isFeatured: { type: "boolean" },
            },
            required: ["name", "credits", "price", "durationDays"],
          },
          UpdatePackage: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              credits: { type: "integer" },
              price: { type: "number" },
              durationDays: { type: "integer" },
              features: { type: "array", items: { type: "string" } },
              sortOrder: { type: "integer" },
              isActive: { type: "boolean" },
              isFeatured: { type: "boolean" },
            },
            required: ["id"],
          },

          // Payment
          PaymentInfo: {
            type: "object",
            properties: {
              bankName: { type: "string" },
              accountName: { type: "string" },
              iban: { type: "string" },
              swiftCode: { type: "string" },
              currency: { type: "string" },
              note: { type: "string" },
              instapayEnabled: { type: "boolean" },
              instapayLink: { type: "string" },
            },
            required: ["bankName", "accountName", "iban", "currency", "instapayEnabled"],
          },
          SubmitPaymentProof: {
            type: "object",
            properties: {
              subscriptionId: { type: "string" },
              transferImage: { type: "string" },
              senderName: { type: "string" },
              senderBank: { type: "string" },
              senderCountry: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" },
              transferDate: { type: "string", format: "date-time" },
              referenceNumber: { type: "string" },
              notes: { type: "string" },
            },
            required: [
              "subscriptionId",
              "transferImage",
              "senderName",
              "senderBank",
              "senderCountry",
              "amount",
              "currency",
              "transferDate",
            ],
          },
          PaymentProof: {
            type: "object",
            properties: {
              id: { type: "string" },
              subscriptionId: { type: "string" },
              userId: { type: "string" },
              amount: { type: "number" },
              currency: { type: "string" },
              status: { type: "string" },
              transferDate: { type: "string", format: "date-time" },
            },
          },
          PaymentListResponse: {
            type: "object",
            properties: {
              payments: { type: "array", items: { $ref: "#/components/schemas/PaymentProof" } },
              nextCursor: { type: "string", nullable: true },
            },
            required: ["payments"],
          },
          ApprovePayment: {
            type: "object",
            properties: { paymentId: { type: "string" } },
            required: ["paymentId"],
          },
          RejectPayment: {
            type: "object",
            properties: { paymentId: { type: "string" }, reason: { type: "string" } },
            required: ["paymentId", "reason"],
          },

          // Provider
          ProviderProfile: {
            type: "object",
            properties: {
              userId: { type: "string" },
              bio: { type: "string" },
              portfolio: { type: "string" },
              skillsTags: { type: "array", items: { type: "string" } },
              isActive: { type: "boolean" },
              user: { $ref: "#/components/schemas/User" },
            },
          },
          AdminStats: {
            type: "object",
            properties: {
              totalUsers: { type: "number" },
              clients: { type: "number" },
              providers: { type: "number" },
              totalRequests: { type: "number" },
              activeRequests: { type: "number" },
              pendingRequests: { type: "number" },
              completedRequests: { type: "number" },
              activeSubscriptions: { type: "number" },
              serviceTypes: { type: "number" },
              averageRating: { type: "number" },
              totalRevenue: { type: "number" },
            },
            required: ["totalUsers", "totalRequests"],
          },

          // Notification
          Notification: {
            type: "object",
            properties: {
              id: { type: "string" },
              userId: { type: "string" },
              title: { type: "string" },
              message: { type: "string" },
              type: { type: "string" },
              isRead: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
            },
            required: ["id", "userId", "title", "message", "type", "isRead", "createdAt"],
          },
          NotificationsListResponse: {
            type: "object",
            properties: {
              notifications: {
                type: "array",
                items: { $ref: "#/components/schemas/Notification" },
              },
              nextCursor: { type: "string", nullable: true },
            },
            required: ["notifications"],
          },
        },
      },
    } as const;
  }
}
