/**
 * Fajl: src/hooks/use-notifications.ts
 * Svrha: hook useNotifications — stanje zvonceta u zaglavlju (FZ-12, FZ-13, UC-08):
 *   - broj nepročitanih (početna vrednost stiže sa servera, bez treptanja)
 *   - poslednjih 5 obaveštenja (učitava se pri otvaranju zvonceta)
 *   - real-time: kad stigne novo obaveštenje (INSERT u tabelu notifications
 *     za mene), ponovo učitava listu, prikazuje toast i osvežava stranicu sa
 *     zahtevima (panel, lista, zahtev, /notifications)
 *   - označavanje jednog ili svih obaveštenja kao pročitanih (kroz API)
 * Koristi ga: NotificationBell.
 * Povezano sa: GET/POST /api/notifications..., useRealtimeEvents (kanal user:<id>),
 * notification-text.ts (tekst iz prevoda).
 */
"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  notificationHref,
  notificationText,
  type NotificationTranslator,
} from "@/components/notifications/notification-text";
import { useApiClient } from "@/hooks/use-api-client";
import { useDebouncedRefresh } from "@/hooks/use-debounced-refresh";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { isLiveRefreshPath } from "@/hooks/use-staff-realtime";
import { ApiClientError } from "@/lib/api/client";
import { REALTIME_EVENTS, userChannel } from "@/lib/realtime/events";
import type { NotificationItem, NotificationList } from "@/lib/validation/notifications";

/** Koliko obaveštenja prikazuje zvonce. */
export const BELL_LIST_SIZE = 5;

/**
 * Stanje i akcije zvonceta.
 * Ulaz: ID prijavljenog korisnika (njegov kanal user:<id>) i broj nepročitanih
 * sa servera (menja se posle svakog osvežavanja stranice).
 * Vraća: unreadCount, items (null = još nije učitano), load, markRead, markAllRead.
 * Uloge: svi prijavljeni (svako samo svoja obaveštenja).
 */
export function useNotifications(userId: string, serverUnreadCount: number) {
  const api = useApiClient();
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useDebouncedRefresh();
  const t = useTranslations("notifications");
  const tErrors = useTranslations("errors");

  // Korak 1: stanje; broj sa servera ima prednost kad se promeni (posle osvežavanja).
  const [unreadCount, setUnreadCount] = useState(serverUnreadCount);
  const [lastServerCount, setLastServerCount] = useState(serverUnreadCount);
  if (serverUnreadCount !== lastServerCount) {
    setLastServerCount(serverUnreadCount);
    setUnreadCount(serverUnreadCount);
  }
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  /** Greška iz API-ja kao prevedena poruka (nikad tiho, NFZ-6). */
  const showError = useCallback(
    (error: unknown) => {
      const code = error instanceof ApiClientError ? error.code : "INTERNAL_ERROR";
      toast.error(tErrors(code));
    },
    [tErrors],
  );

  /** Učitava poslednja obaveštenja i broj nepročitanih. Vraća listu ili null pri grešci. */
  const load = useCallback(async (): Promise<NotificationItem[] | null> => {
    try {
      const page = await api.get<NotificationList>("/notifications", {
        pageSize: BELL_LIST_SIZE,
      });
      setItems(page.items);
      setUnreadCount(page.unreadCount);
      return page.items;
    } catch (error) {
      showError(error);
      return null;
    }
  }, [api, showError]);

  // Korak 2: real-time — novo obaveštenje za mene.
  useRealtimeEvents(
    [{ channel: userChannel(userId), events: [REALTIME_EVENTS.NOTIFICATION_CREATED] }],
    () => {
      void (async () => {
        // Sveža lista (tekst se sastavlja iz prevoda, payload nosi samo ID-jeve).
        const latest = await load();
        const newest = latest?.[0];
        if (newest) {
          const href = notificationHref(newest);
          toast.info(notificationText(t as NotificationTranslator, newest), {
            action: href ? { label: t("open"), onClick: () => router.push(href) } : undefined,
          });
        }
        // Stranice sa zahtevima prikazuju nove podatke bez reload-a.
        if (isLiveRefreshPath(pathname) || pathname === "/notifications") refresh();
      })();
    },
  );

  /**
   * Označava jedno obaveštenje kao pročitano (posle klika na njega).
   * Već pročitano se ne šalje ponovo i ne smanjuje brojač.
   */
  const markRead = useCallback(
    async (item: NotificationItem) => {
      if (item.isRead) return;
      try {
        await api.post(`/notifications/${item.id}/read`);
        setItems((current) =>
          current
            ? current.map((other) => (other.id === item.id ? { ...other, isRead: true } : other))
            : current,
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        showError(error);
      }
    },
    [api, showError],
  );

  /** Označava sva obaveštenja kao pročitana. */
  const markAllRead = useCallback(async () => {
    try {
      await api.post("/notifications/read-all");
      setItems((current) =>
        current ? current.map((item) => ({ ...item, isRead: true })) : current,
      );
      setUnreadCount(0);
      if (pathname === "/notifications") refresh();
    } catch (error) {
      showError(error);
    }
  }, [api, pathname, refresh, showError]);

  return { unreadCount, items, load, markRead, markAllRead };
}
