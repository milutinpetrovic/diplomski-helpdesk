/**
 * Fajl: src/components/dashboard/StatusCountGrid.tsx
 * Svrha: red kartica sa brojem zahteva za svaki status (Otvoren, U obradi,
 * Čeka korisnika, Rešen, Zatvoren), u bojama statusa iz liste zahteva.
 * Svaka kartica vodi na /tickets sa filterom tog statusa.
 * Koriste ga: paneli sve tri uloge.
 */
import { useTranslations } from "next-intl";

import { StatCard } from "@/components/dashboard/StatCard";
import { ticketListHref } from "@/components/tickets/list-params";
import { STATUS_BADGE_CLASSES } from "@/components/tickets/ticket-labels";
import type { StatusCounts } from "@/lib/validation/dashboard";
import type { TicketListQuery } from "@/lib/validation/tickets";
import { TICKET_STATUSES } from "@/types/domain";

/**
 * Kartice po statusu.
 * Ulaz: naslov grupe (preveden), brojevi i dodatni filter za linkove
 * (npr. { assigneeId: "me" } za agentove zahteve).
 */
export function StatusCountGrid({
  title,
  counts,
  filter = {},
}: {
  title: string;
  counts: StatusCounts;
  filter?: Partial<TicketListQuery>;
}) {
  const t = useTranslations("ticketStatus");
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {/* Telefon: dve kolone; tablet: tri; računar: svih pet u redu. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TICKET_STATUSES.map((status) => (
          <StatCard
            key={status}
            label={t(status)}
            value={counts[status]}
            href={ticketListHref({ ...filter, status })}
            className={STATUS_BADGE_CLASSES[status]}
          />
        ))}
      </div>
    </section>
  );
}
