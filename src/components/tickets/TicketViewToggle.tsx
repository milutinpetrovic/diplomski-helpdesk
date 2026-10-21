/**
 * Fajl: src/components/tickets/TicketViewToggle.tsx
 * Svrha: prekidač „Lista / Tabla“ iznad liste zahteva (stranica /tickets).
 * To su dva obična linka: ista adresa sa istim filterima, sa ili bez ?view=board.
 * Zato izbor ostaje u adresi (link vodi na isti prikaz), a „Nazad“ u
 * pregledaču vraća prethodni prikaz. Aktivni prikaz je označen (aria-current).
 * Koristi ga: stranica /tickets. Serverska komponenta (bez "use client").
 * Povezano sa: list-params.ts (ticketListHref), TicketList, TicketBoard.
 */
import Link from "next/link";
import { Columns3, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { ticketListHref, type TicketView } from "@/components/tickets/list-params";
import { cn } from "@/lib/utils";
import type { TicketListQuery } from "@/lib/validation/tickets";

/**
 * Prekidač prikaza.
 * Ulaz: trenutni filteri i prikaz. Pri prelasku na tablu filter statusa se
 * izostavlja (statusi su kolone), a strana se vraća na prvu.
 */
export function TicketViewToggle({ query, view }: { query: TicketListQuery; view: TicketView }) {
  const t = useTranslations("tickets.view");

  // Linkovi za oba prikaza (isti filteri, prva strana).
  const options = [
    { value: "list", icon: List, href: ticketListHref(query, { page: 1, view: "list" }) },
    {
      value: "board",
      icon: Columns3,
      href: ticketListHref(query, { page: 1, status: undefined, view: "board" }),
    },
  ] as const;

  return (
    <nav aria-label={t("label")} className="mb-4 inline-flex rounded-lg border bg-muted/40 p-1">
      {options.map(({ value, icon: Icon, href }) => {
        const active = value === view;
        return (
          <Link
            key={value}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(value)}
          </Link>
        );
      })}
    </nav>
  );
}
