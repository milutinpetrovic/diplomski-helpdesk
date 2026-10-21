/**
 * Fajl: src/components/dashboard/TicketMiniList.tsx
 * Svrha: kratka lista zahteva u kartici na kontrolnom panelu (najviše 5),
 * npr. „Čeka vaš odgovor“ ili „Red čekanja“. Svaki red vodi na detalje zahteva.
 * Koriste ga: DashboardCustomer, DashboardAgent, DashboardAdmin.
 */
import Link from "next/link";
import { useFormatter } from "next-intl";

import { TicketPriorityBadge, TicketStatusBadge } from "@/components/tickets/TicketBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardTicket } from "@/lib/validation/dashboard";

/**
 * Kartica sa listom zahteva.
 * Ulaz: prevedeni naslov, zahtevi, tekst kad je lista prazna, opcioni link
 * „Svi zahtevi“ (lista sa istim filterom), da li se prikazuje status i da li
 * se prikazuje datum kreiranja (za liste „najstariji prvi“) umesto poslednje izmene.
 */
export function TicketMiniList({
  title,
  tickets,
  emptyText,
  moreHref,
  moreLabel,
  showStatus = true,
  showCreatedAt = false,
}: {
  title: string;
  tickets: DashboardTicket[];
  emptyText: string;
  moreHref?: string;
  moreLabel?: string;
  showStatus?: boolean;
  showCreatedAt?: boolean;
}) {
  const format = useFormatter();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {moreHref && moreLabel ? (
          <Link href={moreHref} className="text-sm text-muted-foreground hover:underline">
            {moreLabel}
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="flex flex-col gap-1 rounded-md px-2 py-2 hover:bg-muted/40"
                >
                  {/* Broj i naslov, pa oznake i datum. */}
                  <span className="text-sm">
                    <span className="mr-2 font-mono text-muted-foreground">#{ticket.number}</span>
                    <span className="font-medium">{ticket.title}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {showStatus ? <TicketStatusBadge status={ticket.status} /> : null}
                    <TicketPriorityBadge priority={ticket.priority} />
                    <time
                      dateTime={showCreatedAt ? ticket.createdAt : ticket.updatedAt}
                      className="text-xs text-muted-foreground"
                    >
                      {format.dateTime(
                        new Date(showCreatedAt ? ticket.createdAt : ticket.updatedAt),
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}
                    </time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
