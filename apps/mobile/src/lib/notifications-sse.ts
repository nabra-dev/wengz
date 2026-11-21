import { API_URL } from "./config";
import { getAccessToken, getStoredLocale } from "./auth-store";

export type SseNotification = {
  type?: string;
  title?: string;
  message?: string;
  link?: string;
  data?: { link?: string; requestId?: string; notificationId?: string } | null;
};

type ConnectOptions = {
  onEvent: (notification: SseNotification) => void;
  onOpen?: () => void;
  onError?: () => void;
};

/**
 * Progressive XHR EventSource — React Native has no EventSource that accepts
 * Authorization headers. Parses `data: …\n\n` frames like the web client.
 */
export function connectNotificationsSse(opts: ConnectOptions): () => void {
  let closed = false;
  let xhr: XMLHttpRequest | null = null;
  let buffer = "";
  let lastProcessed = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let attempt = 0;

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const clearPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const consumeProgress = () => {
    if (!xhr || closed) return;
    const text = xhr.responseText;
    if (text.length <= lastProcessed) return;
    const chunk = text.slice(lastProcessed);
    lastProcessed = text.length;
    parseFrames(chunk);
  };

  const parseFrames = (chunk: string) => {
    buffer += chunk;
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const dataLine = part
        .split("\n")
        .map((l) => l.trimEnd())
        .find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      if (!raw || raw === ": heartbeat" || raw.startsWith(":")) continue;
      try {
        const parsed = JSON.parse(raw) as SseNotification;
        if (parsed.type === "connected") {
          attempt = 0;
          opts.onOpen?.();
          continue;
        }
        opts.onEvent(parsed);
      } catch {
        // ignore malformed frames
      }
    }
  };

  const connect = async () => {
    if (closed) return;
    clearReconnect();

    const token = await getAccessToken();
    if (!token) {
      opts.onError?.();
      return;
    }
    const locale = await getStoredLocale();

    clearPoll();
    xhr?.abort();
    xhr = new XMLHttpRequest();
    lastProcessed = 0;
    buffer = "";

    xhr.open("GET", `${API_URL}/api/notifications/sse`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("X-Locale", locale);
    xhr.setRequestHeader("Accept", "text/event-stream");
    xhr.setRequestHeader("Cache-Control", "no-cache");

    // iOS fires onprogress; some Android builds only grow responseText — poll both.
    xhr.onprogress = () => consumeProgress();
    pollTimer = setInterval(consumeProgress, 750);

    xhr.onreadystatechange = () => {
      if (!xhr || closed) return;
      if (xhr.readyState === XMLHttpRequest.LOADING) consumeProgress();
      if (xhr.readyState === XMLHttpRequest.DONE) {
        clearPoll();
        consumeProgress();
        opts.onError?.();
        scheduleReconnect();
      }
    };

    xhr.onerror = () => {
      if (closed) return;
      clearPoll();
      opts.onError?.();
      scheduleReconnect();
    };

    try {
      xhr.send();
    } catch {
      clearPoll();
      opts.onError?.();
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (closed) return;
    attempt += 1;
    if (attempt > 10) return;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt - 1, 4));
    clearReconnect();
    reconnectTimer = setTimeout(() => {
      void connect();
    }, delay);
  };

  void connect();

  return () => {
    closed = true;
    clearReconnect();
    clearPoll();
    xhr?.abort();
    xhr = null;
  };
}
