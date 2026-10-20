/**
 * Fajl: src/components/tickets/TicketPagination.tsx
 * Svrha: prelazak na prethodnu i sledeću stranu liste zahteva (NFZ-3: lista se
 * učitava po 20 zahteva). Linkovi zadržavaju sve filtere iz adrese, menja se samo ?page.
 * Koristi ga: stranica /tickets. Serverska komponenta (obični linkovi).
 * Povezano sa: list-params.ts (ticketListHref), Paginated<T> iz API-ja (page, pageSize, total).
 */
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { ticketListHref } from "@/components/tickets/list-params";
import { Button } from "@/components/ui/button";
import type { TicketListQuery } from "@/lib/validation/tickets";

/**
 * Paginacija.
 * Ulaz: trenutni filteri (sa brojem strane) i ukupan broj zahteva.
 * Ne prikazuje se ako sve staje na jednu stranu.
 */
export function TicketPagination({ query, total }: { query: TicketListQuery; total: number }) {
  const t = useTranslations("tickets.pagination");
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  if (pages <= 1) return null;

  // Strana iza poslednje (npr. ručno upisano ?page=99) i dalje nudi povratak.
  const previous = query.page > 1 ? Math.min(query.page - 1, pages) : null;
  const next = query.page < pages ? query.page + 1 : null;

  return (
    <nav aria-label={t("label")} className="mt-4 flex items-center justify-between gap-2">
      {previous ? (
        <Button asChild variant="outline" size="sm">
          <Link href={ticketListHref(query, { page: previous })} rel="prev">
            <ChevronLeft aria-hidden="true" />
            {t("previous")}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("status", { page: query.page, pages })}
      </p>
      {next ? (
        <Button asChild variant="outline" size="sm">
          <Link href={ticketListHref(query, { page: next })} rel="next">
            {t("next")}
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
