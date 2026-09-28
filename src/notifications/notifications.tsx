import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../legacy/lib/supabase";

export type NotificationService = "ride" | "pakyawan" | "delivery";

export type HubNotification = {
  id: string;
  service: NotificationService;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  entityId: string;
  target: string;
  actionLabel: string | null;
  ownerId: string;
};

export type NotifyInput = {
  id: string;
  service: NotificationService;
  title: string;
  message: string;
  entityId: string;
  target?: string;
  actionLabel?: string | null;
};

type NotificationsContextValue = {
  items: HubNotification[];
  unreadCount: number;
  notify: (input: NotifyInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
};

const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);

const STORAGE_KEY = "bislig-hub-notifications-v1";
const MAX_ITEMS = 60;
const GUEST_OWNER = "guest";

function loadStored(): HubNotification[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as HubNotification[]).filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.createdAt === "number"
    );
  } catch {
    return [];
  }
}

/**
 * Unified notification store. It only LISTENS to the existing
 * ride/pakyawan/delivery workflows — it never drives workflow state.
 * Entries are idempotent by id, so realtime reconnects, polling,
 * refreshes, and foreground recovery can re-emit freely without
 * duplicating. Persisted per signed-in user (or guest) in localStorage;
 * no backend tables or RPCs are involved.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [ownerId, setOwnerId] = useState<string>(GUEST_OWNER);
  const [items, setItems] = useState<HubNotification[]>(() => loadStored());

  useEffect(() => {
    let mounted = true;
    const resolve = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setOwnerId(data.session?.user?.id ?? GUEST_OWNER);
      } catch {
        if (!mounted) return;
        setOwnerId(GUEST_OWNER);
      }
    };
    void resolve();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setOwnerId(session?.user?.id ?? GUEST_OWNER);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items.slice(0, MAX_ITEMS))
      );
    } catch {
      // Private browsing — notifications last for this session only.
    }
  }, [items]);

  const notify = useCallback(
    (input: NotifyInput) => {
      setItems((current) => {
        if (current.some((item) => item.id === input.id)) {
          return current;
        }
        const next: HubNotification = {
          id: input.id,
          service: input.service,
          title: input.title,
          message: input.message,
          createdAt: Date.now(),
          read: false,
          entityId: input.entityId,
          target: input.target ?? "/",
          actionLabel: input.actionLabel ?? null,
          ownerId,
        };
        return [next, ...current].slice(0, MAX_ITEMS);
      });
    },
    [ownerId]
  );

  const markRead = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setItems((current) =>
      current.map((item) =>
        item.ownerId === ownerId ? { ...item, read: true } : item
      )
    );
  }, [ownerId]);

  const removeNotification = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<NotificationsContextValue>(() => {
    const visible = items.filter((item) => item.ownerId === ownerId);
    return {
      items: visible,
      unreadCount: visible.filter((item) => !item.read).length,
      notify,
      markRead,
      markAllRead,
      removeNotification,
    };
  }, [items, ownerId, notify, markRead, markAllRead, removeNotification]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider"
    );
  }
  return context;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
