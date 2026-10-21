/**
 * Fajl: src/components/notifications/NotificationBell.tsx
 * Svrha: zvonce u zaglavlju (FZ-12, FZ-13, UC-08) za sve uloge:
 *   - brojač nepročitanih obaveštenja (crveni krug sa brojem)
 *   - klik otvara padajući prozor sa poslednjih 5 obaveštenja, dugmetom
 *     „Označi sve kao pročitano“ i linkom na stranicu /notifications
 *   - nova obaveštenja stižu u realnom vremenu (toast i brojač), preko useNotifications
 * Koristi ga: AppShell (zaglavlje).
 * Povezano sa: useNotifications, NotificationRow, Popover (src/components/ui/popover.tsx).
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";

import { NotificationRow } from "@/components/notifications/NotificationRow";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/use-notifications";

/** Najveći broj koji se ispisuje na zvoncetu (više od toga je „9+“). */
const MAX_BADGE = 9;

/**
 * Zvonce sa obaveštenjima.
 * Ulaz: ID prijavljenog korisnika i broj nepročitanih sa servera.
 * Uloge: customer, agent, admin.
 */
export function NotificationBell({
  userId,
  unreadCount: serverUnreadCount,
}: {
  userId: string;
  unreadCount: number;
}) {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const { unreadCount, items, load, markRead, markAllRead } = useNotifications(
    userId,
    serverUnreadCount,
  );

  /** Otvaranje prozora učitava sveža obaveštenja. */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) void load();
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0 ? t("bellLabelUnread", { count: unreadCount }) : t("bellLabel")
          }
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white"
            >
              {unreadCount > MAX_BADGE ? `${MAX_BADGE}+` : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        {/* Naslov prozora i „Označi sve kao pročitano“. */}
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <h2 className="text-sm font-semibold">{t("title")}</h2>
          {unreadCount > 0 ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => void markAllRead()}
            >
              {t("markAllRead")}
            </Button>
          ) : null}
        </div>

        {/* Lista: dok se učitava, prazna lista ili poslednjih 5. */}
        <div className="max-h-96 overflow-y-auto p-1" aria-live="polite">
          {items === null ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationRow
                    item={item}
                    onOpen={(selected) => {
                      setOpen(false);
                      void markRead(selected);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Link na sva obaveštenja. */}
        <div className="border-t p-1">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              {t("viewAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
