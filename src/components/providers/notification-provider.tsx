"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { supportsWebNotifications } from "@/lib/device-detection";

interface RealtimeNotification {
  type: "message" | "status_change" | "assignment" | "general" | "connected";
  title?: string;
  message?: string;
  data?: any;
  link?: string;
  timestamp?: Date;
}

interface NotificationEventDetail {
  notification: RealtimeNotification;
  link?: string;
}

interface NotificationContextType {
  isConnected: boolean;
  requestPermission: () => Promise<boolean>;
  hasPermission: boolean;
  unreadCount: number;
  refreshUnreadCount: () => void;
  soundUnlocked: boolean;
  unlockSound: () => Promise<boolean>;
  supportsSystemNotifications: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  isConnected: false,
  requestPermission: async () => false,
  hasPermission: false,
  unreadCount: 0,
  refreshUnreadCount: () => {},
  soundUnlocked: false,
  unlockSound: async () => false,
  supportsSystemNotifications: false,
});

const SOUND_SRC = "/sounds/notification.wav";
const SOUND_UNLOCKED_KEY = "wengz:notificationSoundUnlocked";

let sharedAudio: HTMLAudioElement | null = null;
let soundUnlockedFlag = false;

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio(SOUND_SRC);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 1;
  }
  return sharedAudio;
}

async function unlockNotificationSound(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const audio = getSharedAudio();
    if (!audio) return false;

    audio.muted = true;
    audio.currentTime = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;

    soundUnlockedFlag = true;
    try {
      localStorage.setItem(SOUND_UNLOCKED_KEY, "true");
    } catch {
      // ignore quota / private mode
    }
    return true;
  } catch {
    return false;
  }
}

function playNotificationSound() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  try {
    const audio = getSharedAudio();
    if (!audio) return;

    // Prefer the unlocked shared element; fall back to a fresh instance
    if (soundUnlockedFlag) {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Still blocked — ignore
      });
      return;
    }

    const fallback = new Audio(SOUND_SRC);
    fallback.volume = 1;
    void fallback.play().catch(() => {
      // Autoplay blocked until user gesture
    });
  } catch {
    // ignore
  }
}

function calculateReconnectDelay(attempts: number): number {
  const baseDelay = 1000;
  const maxDelay = 30000;
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempts - 1), maxDelay);
  const jitter = Math.random() * 1000;
  return exponentialDelay + jitter;
}

function navigateToNotification(
  targetPath: string,
  currentPath: string,
  router: { push: (href: string) => void }
) {
  if (normalizePath(currentPath) === normalizePath(targetPath)) {
    globalThis.location.reload();
  } else {
    router.push(targetPath);
  }
}

function normalizePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized.replace(/^\/(en|ar)(\/|$)/, "/");
}

export function NotificationProvider({ children }: { readonly children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations();
  const [isConnected, setIsConnected] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [supportsSystemNotifications] = useState(() =>
    typeof window === "undefined" ? false : supportsWebNotifications()
  );

  const reconnectAttemptsRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Restore prior sound unlock preference and unlock on first gesture
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (localStorage.getItem(SOUND_UNLOCKED_KEY) === "true") {
        soundUnlockedFlag = true;
        setSoundUnlocked(true);
        getSharedAudio();
      }
    } catch {
      // ignore
    }

    const unlockOnGesture = () => {
      void unlockNotificationSound().then((ok) => {
        if (ok) setSoundUnlocked(true);
      });
    };

    const opts: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener("pointerdown", unlockOnGesture, opts);
    window.addEventListener("keydown", unlockOnGesture, opts);
    window.addEventListener("touchstart", unlockOnGesture, opts);

    return () => {
      window.removeEventListener("pointerdown", unlockOnGesture);
      window.removeEventListener("keydown", unlockOnGesture);
      window.removeEventListener("touchstart", unlockOnGesture);
    };
  }, []);

  useEffect(() => {
    if (globalThis.window !== undefined && "Notification" in globalThis) {
      queueMicrotask(() => setHasPermission(Notification.permission === "granted"));
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (status !== "authenticated" || !session?.user) return;

    try {
      const response = await fetch("/api/notifications/unread-count");
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch {
      // ignore
    }
  }, [session, status]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (status !== "authenticated" || !session?.user) return;
      try {
        const response = await fetch("/api/notifications/unread-count");
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (!cancelled) setUnreadCount(data.count || 0);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, status]);

  const unlockSound = useCallback(async () => {
    const ok = await unlockNotificationSound();
    if (ok) setSoundUnlocked(true);
    return ok;
  }, []);

  const requestPermission = useCallback(async () => {
    // Unlock sound in the same user gesture
    await unlockNotificationSound().then((ok) => {
      if (ok) setSoundUnlocked(true);
    });

    if (globalThis.window === undefined || !("Notification" in globalThis)) {
      return false;
    }

    if (!supportsWebNotifications()) {
      return false;
    }

    if (Notification.permission === "granted") {
      setHasPermission(true);
      return true;
    }

    if (Notification.permission !== "denied") {
      try {
        const permission = await Notification.requestPermission();
        const granted = permission === "granted";
        setHasPermission(granted);
        return granted;
      } catch {
        return false;
      }
    }

    return false;
  }, []);

  const showDesktopNotification = useCallback(
    (notification: RealtimeNotification) => {
      if (!supportsWebNotifications()) return;
      if (hasPermission && notification.title && "Notification" in globalThis) {
        try {
          new Notification(notification.title, {
            body: notification.message,
            icon: "/images/logo.svg",
            badge: "/images/logo.svg",
          });
        } catch {
          // Some mobile browsers throw even when permission is granted
        }
      }
    },
    [hasPermission]
  );

  const handleNotificationMessage = useCallback(
    (notification: RealtimeNotification) => {
      if (!notification.title || !notification.message) return;

      const currentPath = globalThis.location.pathname;

      const linkForNav = (() => {
        if (!notification.link) return undefined;
        const path = notification.link;
        const segments = path.split("/").filter(Boolean);
        const first = segments[0];
        const locales = ["en", "ar"];
        // i18n router expects paths without locale prefix
        if (locales.includes(first as "en" | "ar")) {
          const rest = segments.slice(1).join("/");
          return rest ? `/${rest}` : "/";
        }
        return path.startsWith("/") ? path : `/${path}`;
      })();

      toast.info(notification.title, {
        description: notification.message,
        action: linkForNav
          ? {
              label: t("admin.requests.actions.view"),
              onClick: () => navigateToNotification(linkForNav, currentPath, router),
            }
          : undefined,
      });

      void fetchUnreadCount();
      showDesktopNotification(notification);

      const eventDetail: NotificationEventDetail = {
        notification,
        link: linkForNav,
      };
      globalThis.dispatchEvent(
        new CustomEvent<NotificationEventDetail>("wengz:notification", { detail: eventDetail })
      );

      const normalizedCurrentPath = normalizePath(currentPath);
      const normalizedTargetPath = linkForNav ? normalizePath(linkForNav) : "";
      const isCurrentRequestPath =
        normalizedTargetPath.length > 0 &&
        normalizedCurrentPath === normalizedTargetPath &&
        normalizedTargetPath.includes("/requests/");
      if (isCurrentRequestPath) {
        globalThis.dispatchEvent(
          new CustomEvent<NotificationEventDetail>("wengz:request-thread-updated", {
            detail: eventDetail,
          })
        );
      }

      playNotificationSound();
    },
    [router, showDesktopNotification, t, fetchUnreadCount]
  );

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      return;
    }

    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const clearReconnect = () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const scheduleReconnect = (connect: () => void) => {
      const maxAttempts = 10;
      reconnectAttemptsRef.current += 1;

      if (reconnectAttemptsRef.current > maxAttempts) {
        toast.error(t("client.notifications.title"), {
          description: t("dashboard.alerts.connectionLost"),
          duration: 10000,
        });
        return;
      }

      const delay = calculateReconnectDelay(reconnectAttemptsRef.current);
      clearReconnect();
      reconnectTimeout = setTimeout(() => {
        if (isMounted) connect();
      }, delay);
    };

    const handleOpen = () => {
      if (!isMounted) return;
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    const handleError = (connect: () => void) => {
      if (!isMounted) return;
      setIsConnected(false);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      scheduleReconnect(connect);
    };

    const handleMessage = (event: MessageEvent) => {
      if (!isMounted) return;

      try {
        const notification: RealtimeNotification = JSON.parse(event.data);
        if (notification.type === "connected") return;
        handleNotificationMessage(notification);
      } catch {
        // ignore malformed payloads
      }
    };

    const connect = () => {
      if (!isMounted) return;

      try {
        eventSourceRef.current?.close();
        const es = new EventSource("/api/notifications/sse");
        eventSourceRef.current = es;
        es.onopen = () => handleOpen();
        es.onerror = () => handleError(connect);
        es.onmessage = handleMessage;
      } catch {
        if (isMounted) setIsConnected(false);
      }
    };

    const forceReconnect = () => {
      if (!isMounted) return;
      reconnectAttemptsRef.current = 0;
      clearReconnect();
      connect();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Phone sleep / tab switch often kills EventSource — reconnect when returning
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          forceReconnect();
        } else if (eventSourceRef.current.readyState === EventSource.CONNECTING) {
          // already reconnecting
        } else {
          void fetchUnreadCount();
        }
      }
    };

    const onOnline = () => {
      forceReconnect();
      void fetchUnreadCount();
    };

    connect();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onOnline);

    return () => {
      isMounted = false;
      clearReconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onOnline);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [session, status, handleNotificationMessage, t, fetchUnreadCount]);

  const contextValue = useMemo(
    () => ({
      isConnected,
      requestPermission,
      hasPermission,
      unreadCount,
      refreshUnreadCount: fetchUnreadCount,
      soundUnlocked,
      unlockSound,
      supportsSystemNotifications,
    }),
    [
      isConnected,
      requestPermission,
      hasPermission,
      unreadCount,
      fetchUnreadCount,
      soundUnlocked,
      unlockSound,
      supportsSystemNotifications,
    ]
  );

  return (
    <NotificationContext.Provider value={contextValue}>{children}</NotificationContext.Provider>
  );
}

export function useRealtimeNotifications() {
  return useContext(NotificationContext);
}
