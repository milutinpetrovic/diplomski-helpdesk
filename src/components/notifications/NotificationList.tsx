/**
 * Fajl: src/components/notifications/NotificationList.tsx
 * Svrha: sadržaj stranice /notifications (UC-08): filter „Sva / Nepročitana“,
 * dugme „Označi sve kao pročitano“, lista obaveštenja i prelazak na
 * prethodnu i sledeću stranu.
 * Klik na obaveštenje ga označava kao pročitano (POST /api/notifications/{id}/read)
 * i otvara zahtev. Nova obaveštenja stižu u realnom vremenu: zvonce tada
 * osvežava ovu stranicu (useNotifications).
 * Koristi ga: src/app/(app)/notifications/page.tsx.
 * Povezano sa: NotificationRow, notification-params.ts, useApiAction.
 */
"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { notificationListHref } from "@/components/notifications/notification-params";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { Button } from "@/components/ui/button";
import { useApiAction } from "@/hooks/use-api-action";
import { useApiClient } from "@/hooks/use-api-client";
import type { NotificationList as NotificationPage } from "@/lib/validation/notifications";
import { cn } from "@/lib/utils";

/**
 * Lista obaveštenja.
 * Ulaz: stranica obaveštenja iz servisa i da li je uključen filter „Nepročitana“.
 * Uloge: customer, agent, admin.
 */
export function NotificationList({
  page,
  unreadOnly,
}: {
  page: NotificationPage;
  unreadOnly: boolean;
}) {
  const t = useTranslations("notifications");
  const api = useApiClient();
  const { run, pending } = useApiAction();
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <>
      {/* Filter i „Označi sve kao pročitano“. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label={t("filterLabel")} className="flex gap-1 rounded-md border p-1">
          {[false, true].map((value) => (
            <Link
              key={String(value)}
              href={notificationListHref(value)}
              aria-current={value === unreadOnly ? "page" : undefined}
              className={cn(
                "rounded px-3 py-1 text-sm",
                value === unreadOnly ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {value ? t("filterUnread", { count: page.unreadCount }) : t("filterAll")}
            </Link>
          ))}
        </nav>
        {page.unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              void run((client) => client.post("/notifications/read-all"), t("markedAllRead"))
            }
          >
            {t("markAllRead")}
          </Button>
        ) : null}
      </div>

      {/* Lista ili poruka da nema obaveštenja. */}
      {page.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {unreadOnly ? t("emptyUnread") : t("empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {page.items.map((item) => (
            <li key={item.id}>
              <NotificationRow
                item={item}
                onOpen={(selected) => {
                  // Označavanje ide u pozadini; stranica zahteva se otvara odmah.
                  if (!selected.isRead)
                    void api.post(`/notifications/${selected.id}/read`).catch(() => {});
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Paginacija (NFZ-3): ne prikazuje se ako sve staje na jednu stranu. */}
      {pages > 1 ? (
        <nav aria-label={t("pagination")} className="mt-4 flex items-center justify-between gap-2">
          {page.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={notificationListHref(unreadOnly, Math.min(page.page - 1, pages))}
                rel="prev"
              >
                <ChevronLeft aria-hidden="true" />
                {t("previous")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <p className="text-sm text-muted-foreground">
            {t("pageStatus", { page: page.page, pages })}
          </p>
          {page.page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={notificationListHref(unreadOnly, page.page + 1)} rel="next">
                {t("next")}
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
