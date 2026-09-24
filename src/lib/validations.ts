import { z } from "zod";

// Common validation patterns
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address");

export const passwordSchema = z.string().min(1, "Password is required");

export const simplePasswordSchema = z.string().min(1, "Password is required");

export const nameSchema = z.string().min(1, "Name is required");

export const urlSchema = z.string().url("Please enter a valid URL").or(z.literal(""));

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number")
  .or(z.literal(""));

// Phone number without country code (for use with separate country code selector)
export const phoneNumberOnlySchema = z
  .string()
  .regex(/^\d{7,15}$/, "Please enter a valid phone number (7-15 digits)")
  .or(z.literal(""));

// Phone with country code (e.g., +20 1234567890)
export const phoneWithCountryCodeSchema = z
  .string()
  .regex(
    /^\+[1-9]\d{1,3}\s\d{7,15}$/,
    "Phone must be in format: +countryCode phoneNumber (e.g., +20 1234567890)"
  )
  .optional();

// Login form validation
export const loginFormSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Registration form validation
export const registerFormSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: simplePasswordSchema,
    confirmPassword: z.string(),
    role: z.enum(["CLIENT", "PROVIDER"]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Request form validation
export const createRequestSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  serviceTypeId: z.string().min(1, "Please select a service type"),
  priority: z.number().min(1).max(5),
});

// Comment validation
export const commentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty"),
});

// Deliverable validation
export const deliverableSchema = z.object({
  deliverableMessage: z.string().min(1, "Deliverable message is required"),
  files: z.array(z.string()).optional(),
});

// Revision request validation
export const revisionRequestSchema = z.object({
  feedback: z.string().min(1, "Feedback is required"),
});

// Rating validation
export const ratingSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  reviewText: z.string().optional(),
});

// Profile update validation
export const profileUpdateSchema = z.object({
  name: nameSchema,
  bio: z.string().optional(),
  portfolio: urlSchema.optional(),
  skillsTags: z.array(z.string()).optional(),
});

// Type inference helpers
export type LoginFormData = z.infer<typeof loginFormSchema>;
export type RegisterFormData = z.infer<typeof registerFormSchema>;
export type CreateRequestData = z.infer<typeof createRequestSchema>;
export type CommentData = z.infer<typeof commentSchema>;
export type DeliverableData = z.infer<typeof deliverableSchema>;
export type RevisionRequestData = z.infer<typeof revisionRequestSchema>;
export type RatingData = z.infer<typeof ratingSchema>;
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

// Validation helper function
export function validateField<T>(
  schema: z.ZodType<T>,
  value: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || "Invalid value" };
  // Note: For full i18n support, pass locale and use: getTranslation(locale, "errors.invalidValue")
}

// Form error extractor
export function getFormErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}
