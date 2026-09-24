import { logActivityAsync, type ActivityAction, type ActivityLevel } from "@/lib/activity-log";

export const REQUEST_ENTITY_TYPE = "Request";

export type RequestActivityAction =
  | "request.create"
  | "request.claim"
  | "request.assign"
  | "request.unassign"
  | "request.accept"
  | "request.start"
  | "request.status"
  | "request.deliver"
  | "request.revision"
  | "request.approve"
  | "request.message"
  | "request.rate"
  | "request.delete"
  | "request.restore";

type LogRequestActivityInput = {
  action: RequestActivityAction;
  requestId: string;
  message: string;
  actorId?: string | null;
  actorRole?: string | null;
  /** User-supplied note / feedback / deliverable text when present */
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  level?: ActivityLevel;
};

/**
 * Fire-and-forget ActivityLog row scoped to a Request entity.
 * Prefer this over raw logActivityAsync for request lifecycle events.
 */
export function logRequestActivity(input: LogRequestActivityInput): void {
  const reason = input.reason?.trim() || null;
  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
  };
  if (reason) {
    metadata.reason = reason;
  }

  logActivityAsync({
    action: input.action as ActivityAction,
    message: input.message,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    entityType: REQUEST_ENTITY_TYPE,
    entityId: input.requestId,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    level: input.level ?? "info",
  });
}
