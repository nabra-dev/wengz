import { z } from "zod";

// Common validation patterns
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address");

/** Shared account password policy (register, reset, change, admin create). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordSchema = z
  .string()
  .trim()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

/** @deprecated Use passwordSchema — kept as an alias for existing imports. */
export const simplePasswordSchema = passwordSchema;

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

/** Trim + lowercase before email validation (forms often include padding spaces). */
export const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Please enter a valid email address");

// Login: do not enforce new-password policy (legacy short passwords may still exist).
export const loginFormSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1, "Password is required"),
});

// Client registration form validation
export const registerFormSchema = z
  .object({
    name: nameSchema,
    email: normalizedEmailSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
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
