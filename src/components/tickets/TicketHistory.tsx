/**
 * Fajl: src/components/tickets/TicketHistory.tsx
 * Svrha: istorija promena zahteva (audit log, FZ-9): ko je, šta i kada
 * promenio — kreiranje, status, dodela, prioritet, kategorija, izmena teksta, ocena.
 * Stare i nove vrednosti (oldValue / newValue iz tabele ticket_history) se
 * prevode: status „resolved“ se prikazuje kao „Rešen“, ID kategorije kao njen naziv.
 * Koristi ga: stranica /tickets/[id]. Serverska komponenta.
 * Povezano sa: TicketService.getHistory, GET /api/tickets/{id}/history,
 * RPC funkcije u supabase/migrations/..._rpc_tickets.sql (oblik oldValue/newValue).
 */
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { categoryName } from "@/components/tickets/ticket-labels";
import type { Category } from "@/lib/validation/categories";
import type { TicketHistoryEntry } from "@/lib/validation/tickets";

/** Čita tekstualnu vrednost iz oldValue/newValue (npr. { status: "open" } -> "open"). */
function readValue(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

/**
 * Istorija promena.
 * Ulaz: stavke istorije (od najstarije) i poznate kategorije (za nazive).
 */
export function TicketHistory({
  entries,
  categories,
}: {
  entries: TicketHistoryEntry[];
  categories: Category[];
}) {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const unknown = t("tickets.history.unknown");

  /** Prevedeni status ili prioritet; nepoznata vrednost -> „nepoznato“. */
  const label = (section: "ticketStatus" | "ticketPriority", value: string | null) =>
    value && t.has(`${section}.${value}`) ? t(`${section}.${value}`) : unknown;

  /** Naziv kategorije po ID-ju. */
  const category = (id: string | null) =>
    categoryName(categories.find((item) => item.id === id) ?? null, locale) ?? unknown;

  /** Jedna rečenica opisa promene, po vrsti stavke. */
  function describe(entry: TicketHistoryEntry): string {
    const { oldValue, newValue } = entry;
    switch (entry.action) {
      case "status_changed":
        return t("tickets.history.status_changed", {
          from: label("ticketStatus", readValue(oldValue, "status")),
          to: label("ticketStatus", readValue(newValue, "status")),
        });
      case "priority_changed":
        return t("tickets.history.priority_changed", {
          from: label("ticketPriority", readValue(oldValue, "priority")),
          to: label("ticketPriority", readValue(newValue, "priority")),
        });
      case "category_changed":
        return t("tickets.history.category_changed", {
          from: category(readValue(oldValue, "category_id")),
          to: category(readValue(newValue, "category_id")),
        });
      case "assigned":
      case "unassigned":
        return t(`tickets.history.${entry.action}`, {
          name: entry.assignee?.fullName ?? unknown,
        });
      case "rated":
        return t("tickets.history.rated", { score: readValue(newValue, "score") ?? "?" });
      case "created":
      case "updated":
        return t(`tickets.history.${entry.action}`);
    }
  }

  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <h2 id="history-title" className="text-lg font-semibold">
        {t("tickets.history.title")}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tickets.history.empty")}</p>
      ) : (
        // Vremenska linija: tačka i linija sa leve strane svake stavke.
        <ol className="flex flex-col border-l pl-4">
          {entries.map((entry) => (
            <li key={entry.id} className="relative pb-3 last:pb-0">
              <span
                className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm">{describe(entry)}</p>
              <p className="text-xs text-muted-foreground">
                {entry.actor?.fullName ?? t("tickets.history.system")} ·{" "}
                <time dateTime={entry.createdAt}>
                  {format.dateTime(new Date(entry.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
