/**
 * Fajl: src/components/notifications/NotificationRow.tsx
 * Svrha: jedan red obaveštenja: tačka za nepročitano, tekst iz prevoda
 * (npr. „Jelena Agentić je promenila status zahteva #1003“), naslov zahteva i vreme.
 * Ceo red je link na zahtev; klik ga označava kao pročitano.
 * Koriste ga: NotificationBell (padajući prozor) i NotificationList (/notifications).
 * Povezano sa: notification-text.ts, NotificationItem (src/lib/validation/notifications.ts).
 */
"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import {
  notificationHref,
  notificationText,
  type NotificationTranslator,
} from "@/components/notifications/notification-text";
import type { NotificationItem } from "@/lib/validation/notifications";
import { cn } from "@/lib/utils";

/**
 * Red obaveštenja.
 * Ulaz: obaveštenje i funkcija koja se poziva pri kliku (označavanje kao pročitano).
 */
export function NotificationRow({
  item,
  onOpen,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
}) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const href = notificationHref(item);

  // Sadržaj reda: tekst, naslov zahteva i vreme; nepročitano je podebljano i sa tačkom.
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          item.isRead ? "bg-transparent" : "bg-primary",
        )}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("text-sm", item.isRead ? "text-foreground" : "font-semibold")}>
          {notificationText(t as NotificationTranslator, item)}
          {item.isRead ? null : <span className="sr-only"> ({t("unread")})</span>}
        </span>
        {item.ticketTitle ? (
          <span className="truncate text-xs text-muted-foreground">{item.ticketTitle}</span>
        ) : null}
        <time dateTime={item.createdAt} className="text-xs text-muted-foreground">
          {format.dateTime(new Date(item.createdAt), { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </span>
    </>
  );

  const className = "flex w-full gap-3 rounded-md px-3 py-2 text-left";
  return href ? (
    <Link
      href={href}
      onClick={() => onOpen(item)}
      className={cn(
        className,
        "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
      )}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
