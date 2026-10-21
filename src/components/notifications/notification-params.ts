/**
 * Fajl: src/components/notifications/notification-params.ts
 * Svrha: čitanje i pravljenje adrese stranice /notifications (?unreadOnly=true&page=2),
 * sa istom Zod šemom kao GET /api/notifications.
 * Koriste ga: stranica /notifications i NotificationList (filter i paginacija).
 */
import {
  notificationListQuerySchema,
  type NotificationListQuery,
} from "@/lib/validation/notifications";

/** Parametri iz adrese, kako ih Next.js daje stranici. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Čita parametre iz adrese. Neispravna vrednost (npr. ?page=abc) se
 * zanemaruje, pa se prikazuje prva strana svih obaveštenja.
 */
export function parseNotificationParams(raw: RawSearchParams): NotificationListQuery {
  const first = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const result = notificationListQuerySchema.safeParse({
    page: first("page") || undefined,
    unreadOnly: first("unreadOnly") || undefined,
  });
  return result.success ? result.data : notificationListQuerySchema.parse({});
}

/**
 * Adresa stranice za dati filter i stranu.
 * Vraća: npr. "/notifications?unreadOnly=true&page=2"; podrazumevano samo "/notifications".
 */
export function notificationListHref(unreadOnly: boolean, page = 1): string {
  const params = new URLSearchParams();
  if (unreadOnly) params.set("unreadOnly", "true");
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `/notifications?${text}` : "/notifications";
}
