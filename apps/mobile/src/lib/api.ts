import { REST_BASE, UPLOAD_URL } from "./config";
import { clearSession, getAccessToken, getStoredLocale } from "./auth-store";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  formData?: FormData;
};

async function buildHeaders(auth: boolean, isForm: boolean): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "X-Locale": await getStoredLocale(),
  };
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Call OpenAPI REST bridge: `/api/rest/<path>` */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const auth = opts.auth !== false;
  const isForm = Boolean(opts.formData);
  const headers = await buildHeaders(auth, isForm);
  const url = path.startsWith("http")
    ? path
    : `${REST_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body || opts.formData ? "POST" : "GET"),
      headers,
      body: opts.formData
        ? opts.formData
        : opts.body !== undefined
          ? JSON.stringify(opts.body)
          : undefined,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Network request failed";
    throw new ApiError(
      `Cannot reach API at ${REST_BASE} (${detail}). Is the Next.js server running on EXPO_PUBLIC_API_URL?`,
      0,
      "NETWORK_ERROR"
    );
  }

  if (res.status === 401 && auth) {
    await clearSession();
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: string }).message)
        : typeof data === "object" && data && "error" in data
          ? String((data as { error: string }).error)
          : `Request failed (${res.status})`;
    const code = msg.includes(":") ? msg.split(":")[0] : undefined;
    throw new ApiError(msg, res.status, code);
  }

  return data as T;
}

export async function uploadFile(uri: string, name: string, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append("file", {
    uri,
    name,
    type: mimeType,
  } as unknown as Blob);

  const headers = await buildHeaders(true, true);
  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers,
    body: form,
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new ApiError(data.error || "Upload failed", res.status);
  }
  return data.url;
}

// ---- Typed helpers ----

export function mobileLogin(email: string, password: string) {
  return apiRequest<{
    accessToken: string;
    tokenType: "Bearer";
    expiresIn: number;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      image: string | null;
      phone: string | null;
    };
  }>("/auth/mobile-login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

export function getActiveSubscription() {
  return apiRequest<Record<string, unknown> | null>("/subscription/active");
}

export function getPendingSubscription() {
  return apiRequest<Record<string, unknown> | null>("/subscription/pending");
}

export function getUsageStats() {
  return apiRequest<{
    activeRequests?: number;
    completedRequests?: number;
    totalRequests?: number;
  }>("/subscription/usage");
}

export function cancelSubscription(subscriptionId: string) {
  return apiRequest("/subscription/cancel", {
    method: "POST",
    body: { subscriptionId },
  });
}

export function getTransactionHistory() {
  return apiRequest<Record<string, unknown>[]>("/subscription/transactions");
}

export function getRequests(limit = 50) {
  return apiRequest<{ requests: Record<string, unknown>[]; nextCursor: string | null }>(
    `/request/list?limit=${limit}`
  );
}

export function getRequest(id: string) {
  return apiRequest<Record<string, unknown>>(`/request/${id}`);
}

export function addComment(requestId: string, content: string, files: string[] = []) {
  return apiRequest("/request/comment", {
    method: "POST",
    body: { requestId, content, files },
  });
}

export function getNotifications(limit = 40) {
  return apiRequest<{ notifications: Record<string, unknown>[]; nextCursor: string | null }>(
    `/notification?limit=${limit}`
  );
}

export function markNotificationRead(id: string) {
  return apiRequest("/notification/mark-read", { method: "POST", body: { id } });
}

export function markAllNotificationsRead() {
  return apiRequest("/notification/mark-all-read", { method: "POST" });
}

export function getUnreadCount() {
  return apiRequest<{ count: number }>("/notification/unread-count");
}

export function getProfile() {
  return apiRequest<Record<string, unknown>>("/user/me");
}

export function updateProfile(data: {
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
}) {
  return apiRequest("/user/me", { method: "PUT", body: data });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest("/user/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

export function getPackages() {
  return apiRequest<Record<string, unknown>[]>("/package");
}

export function subscribe(packageId: string) {
  return apiRequest<{
    success: boolean;
    subscription: Record<string, unknown>;
    requiresPayment: boolean;
    message: string;
  }>("/subscription/subscribe", { method: "POST", body: { packageId } });
}

export function getPaymentInfo() {
  return apiRequest<Record<string, unknown>>("/payment/info");
}

export function submitPaymentProof(body: Record<string, unknown>) {
  return apiRequest("/payment/submit-proof", { method: "POST", body });
}

export function getServiceTypes() {
  return apiRequest<Record<string, unknown>[]>("/services");
}

export function createRequest(body: Record<string, unknown>) {
  return apiRequest("/request", { method: "POST", body });
}

export function requestRevision(requestId: string, feedback: string) {
  return apiRequest("/request/revision", {
    method: "POST",
    body: { requestId, feedback },
  });
}

export function approveRequest(requestId: string) {
  return apiRequest("/request/approve", { method: "POST", body: { requestId } });
}

export function rateRequest(requestId: string, rating: number, reviewText?: string) {
  return apiRequest("/request/rate", {
    method: "POST",
    body: { requestId, rating, reviewText },
  });
}

export function registerPushDevice(token: string, platform: "ios" | "android" | "web") {
  return apiRequest("/notification/push-device", {
    method: "POST",
    body: { token, platform },
  });
}

export function requestPasswordReset(email: string) {
  return apiRequest("/auth/forgot-password", {
    method: "POST",
    auth: false,
    body: { email },
  });
}

export function resetPassword(token: string, newPassword: string, confirmPassword: string) {
  return apiRequest("/auth/reset-password", {
    method: "POST",
    auth: false,
    body: { token, newPassword, confirmPassword },
  });
}
