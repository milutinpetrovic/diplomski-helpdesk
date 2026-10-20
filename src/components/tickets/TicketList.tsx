/**
 * Fajl: src/components/tickets/TicketList.tsx
 * Svrha: prikaz jedne stranice liste zahteva (UC-10, UC-15, UC-19), na dva načina:
 *   - tabela na računaru (od 768 px)
 *   - kartice na telefonu (tabela sa mnogo kolona se tamo ne čita dobro, NFZ-1)
 * Korisnik ne vidi kolonu „Podnosilac“ (svi zahtevi su njegovi); tim podrške je vidi.
 * Koristi ga: stranica /tickets. Serverska komponenta (bez "use client").
 * Povezano sa: TicketBadges, ticket-labels.ts (naziv kategorije), GET /api/tickets (isti oblik podataka).
 */
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { TicketPriorityBadge, TicketStatusBadge } from "@/components/tickets/TicketBadges";
import { categoryName } from "@/components/tickets/ticket-labels";
import type { TicketListItem } from "@/lib/validation/tickets";

/**
 * Lista zahteva.
 * Ulaz: zahtevi na ovoj stranici i da li se prikazuje kolona „Podnosilac“ (tim podrške).
 */
export function TicketList({
  items,
  showCreator,
}: {
  items: TicketListItem[];
  showCreator: boolean;
}) {
  const t = useTranslations("tickets");
  const format = useFormatter();
  const locale = useLocale();

  /** Datum poslednje izmene, kratko (npr. „20. okt 2026, 18:00“). */
  const formatDate = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      {/* Tabela (računar). */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("list.caption")}</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.number")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.title")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.status")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.priority")}
              </th>
              {showCreator ? (
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("columns.creator")}
                </th>
              ) : null}
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.assignee")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("columns.updatedAt")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-muted-foreground">#{ticket.number}</td>
                <td className="max-w-80 px-3 py-2">
                  {/* Naslov je link ka detaljima; ispod je kategorija. */}
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="line-clamp-2 font-medium hover:underline"
                  >
                    {ticket.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {categoryName(ticket.category, locale) ?? t("list.noCategory")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <TicketStatusBadge status={ticket.status} />
                </td>
                <td className="px-3 py-2">
                  <TicketPriorityBadge priority={ticket.priority} />
                </td>
                {showCreator ? (
                  <td className="px-3 py-2">{ticket.creator?.fullName ?? "—"}</td>
                ) : null}
                <td className="px-3 py-2">
                  {ticket.assignee?.fullName ?? (
                    <span className="text-muted-foreground">{t("list.unassigned")}</span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {formatDate(ticket.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kartice (telefon). Cela kartica je link ka detaljima. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={`/tickets/${ticket.id}`}
              className="flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">#{ticket.number}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(ticket.updatedAt)}
                </span>
              </div>
              <span className="font-medium">{ticket.title}</span>
              <div className="flex flex-wrap gap-2">
                <TicketStatusBadge status={ticket.status} />
                <TicketPriorityBadge priority={ticket.priority} />
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <dt className="text-muted-foreground">{t("columns.category")}</dt>
                <dd>{categoryName(ticket.category, locale) ?? t("list.noCategory")}</dd>
                {showCreator ? (
                  <>
                    <dt className="text-muted-foreground">{t("columns.creator")}</dt>
                    <dd>{ticket.creator?.fullName ?? "—"}</dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">{t("columns.assignee")}</dt>
                <dd>{ticket.assignee?.fullName ?? t("list.unassigned")}</dd>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
