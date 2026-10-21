/**
 * Fajl: src/components/notifications/notification-text.ts
 * Svrha: sastavlja tekst obaveštenja iz prevoda. API vraća samo vrstu
 * obaveštenja, broj zahteva i ime aktera, a tekst je u messages/*.json pod
 * notifications.types.<vrsta>, npr. „{actor} je promenio/la status zahteva #{number}“.
 * Tako je tekst uvek na jeziku koji je korisnik izabrao.
 * Koriste ga: NotificationBell (lista i toast poruka) i NotificationList (/notifications).
 */
import type { NotificationItem } from "@/lib/validation/notifications";

/** Funkcija prevoda za grupu notifications (iz useTranslations / getTranslations). */
export type NotificationTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/** Putanja zahteva na koji obaveštenje vodi, ili null ako ga više nema. */
export function notificationHref(item: Pick<NotificationItem, "ticketId">): string | null {
  return item.ticketId ? `/tickets/${item.ticketId}` : null;
}

/**
 * Tekst obaveštenja.
 * Ulaz: funkcija prevoda (grupa notifications) i obaveštenje.
 * Vraća: npr. „Jelena Agentić je promenila status zahteva #1003“; kad ime
 * nije poznato, koristi se „Neko“, a kad zahtev nije vidljiv, „#?“.
 */
export function notificationText(
  t: NotificationTranslator,
  item: Pick<NotificationItem, "type" | "actorName" | "ticketNumber">,
): string {
  return t(`types.${item.type}`, {
    actor: item.actorName ?? t("someone"),
    number: item.ticketNumber ?? "?",
  });
}
