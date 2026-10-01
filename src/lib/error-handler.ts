import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import { ZodError } from "zod";

interface ZodErrorData {
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
}

// Type for translation function - can be passed optionally
type TranslateFn = (key: string) => string;

/**
 * Maps tRPC error codes to user-friendly messages
 */
function getMessageForCode(code: string | undefined, message: string, t?: TranslateFn): string {
  if (!t) {
    // Fallback to English if no translation function provided
    switch (code) {
      case "UNAUTHORIZED":
        return "You need to be logged in to perform this action";
      case "FORBIDDEN":
        return "You don't have permission to perform this action";
      case "NOT_FOUND":
        return message || "The requested resource was not found";
      case "BAD_REQUEST":
        return message || "Invalid request. Please check your input.";
      case "TOO_MANY_REQUESTS":
        return message || "Too many attempts. Please wait and try again.";
      case "CONFLICT":
        return message || "A conflict occurred. Please try again.";
      case "INTERNAL_SERVER_ERROR":
        return "An unexpected error occurred. Please try again later.";
      default:
        return message || "Something went wrong";
    }
  }

  switch (code) {
    case "UNAUTHORIZED":
      return t("errors.unauthorized");
    case "FORBIDDEN":
      return t("errors.forbidden");
    case "NOT_FOUND":
      return message || t("errors.notFound");
    case "BAD_REQUEST":
      return message || t("errors.badRequest");
    case "TOO_MANY_REQUESTS":
      return message || t("errors.tooManyRequests");
    case "CONFLICT":
      return message || t("errors.conflict");
    case "INTERNAL_SERVER_ERROR":
      return t("errors.internalError");
    default:
      return message || t("errors.somethingWrong");
  }
}

/**
 * Extracts error message from Zod validation error data
 */
function getZodErrorMessage(zodError: ZodErrorData): string | null {
  if (zodError.fieldErrors) {
    const firstFieldError = Object.values(zodError.fieldErrors).flat()[0];
    if (firstFieldError) return firstFieldError;
  }
  if (zodError.formErrors && zodError.formErrors.length > 0) {
    return zodError.formErrors[0];
  }
  return null;
}

/**
 * Handles tRPC client errors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleTRPCError(error: TRPCClientError<any>, t?: TranslateFn): string {
  const message = error.message;
  const data = error.data as Record<string, unknown> | undefined;

  if (data?.zodError) {
    const zodMessage = getZodErrorMessage(data.zodError as ZodErrorData);
    if (zodMessage) return zodMessage;
  }

  return getMessageForCode(data?.code as string | undefined, message, t);
}

/**
 * Handles network-related error messages
 */
function handleNetworkError(message: string, t?: TranslateFn): string | null {
  if (message.includes("fetch failed") || message.includes("Network Error")) {
    return t
      ? t("errors.networkError")
      : "Unable to connect to the server. Please check your internet connection.";
  }
  return null;
}

/**
 * Extracts a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown, t?: TranslateFn): string {
  if (error instanceof TRPCClientError) {
    return handleTRPCError(error, t);
  }

  if (error instanceof ZodError) {
    const firstError = error.errors[0];
    return firstError?.message ?? (t ? t("errors.validationError") : "Validation error occurred");
  }

  if (error instanceof Error) {
    return handleNetworkError(error.message, t) ?? error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return t ? t("errors.unexpectedError") : "An unexpected error occurred";
}

/**
 * Shows an error toast with the extracted error message
 */
export function showError(error: unknown, title?: string, t?: TranslateFn) {
  const message = getErrorMessage(error, t);
  toast.error(title || (t ? t("errors.titles.error") : "Error"), {
    description: message,
    duration: 5000,
  });
}

/**
 * Shows a success toast
 */
export function showSuccess(message: string, title?: string, t?: TranslateFn) {
  toast.success(title || (t ? t("errors.titles.success") : "Success"), {
    description: message,
    duration: 3000,
  });
}

/**
 * Shows an info toast
 */
export function showInfo(message: string, title?: string, t?: TranslateFn) {
  toast.info(title || (t ? t("errors.titles.info") : "Info"), {
    description: message,
    duration: 4000,
  });
}

/**
 * Shows a warning toast
 */
export function showWarning(message: string, title?: string, t?: TranslateFn) {
  toast.warning(title || (t ? t("errors.titles.warning") : "Warning"), {
    description: message,
    duration: 4000,
  });
}

/**
 * Shows a loading toast that returns a function to dismiss it
 */
export function showLoading(message: string) {
  return toast.loading(message);
}

/**
 * Dismisses a toast by id
 */
export function dismissToast(toastId: string | number) {
  toast.dismiss(toastId);
}

/**
 * Shows a promise toast that handles loading, success, and error states
 */
export function showPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  },
  t?: TranslateFn
) {
  return toast.promise(promise, {
    loading: messages.loading,
    success: (data) =>
      typeof messages.success === "function" ? messages.success(data) : messages.success,
    error: (err) =>
      typeof messages.error === "function" ? messages.error(err) : getErrorMessage(err, t),
  });
}
