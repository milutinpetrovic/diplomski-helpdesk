/**
 * Fajl: src/components/tickets/TicketFilters.tsx
 * Svrha: pretraga, filteri i sortiranje iznad liste zahteva (FZ-10).
 * Izbor u padajućoj listi odmah primenjuje filter; pretraga se primenjuje na
 * Enter ili dugme „Traži“. Filteri se upisuju u adresu stranice
 * (/tickets?status=open&q=vpn), pa server učitava novu listu, a link se može podeliti.
 * Filter „Dodeljen“ vidi samo tim podrške (korisnik vidi samo svoje zahteve).
 * Koristi ga: stranica /tickets. Klijentska komponenta (reaguje na izbor).
 * Povezano sa: list-params.ts (adresa <-> filteri), GET /api/tickets (isti parametri).
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { ticketListHref } from "@/components/tickets/list-params";
import { categoryName, SORT_LABEL_KEYS } from "@/components/tickets/ticket-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { AgentSummary } from "@/lib/validation/admin";
import type { Category } from "@/lib/validation/categories";
import { TICKET_SORTS, type TicketListQuery } from "@/lib/validation/tickets";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/domain";

/** Polja forme filtera (imena su ista kao parametri u adresi). */
const FILTER_FIELDS = ["q", "status", "priority", "categoryId", "assigneeId", "sort"] as const;

/**
 * Forma filtera.
 * Ulaz: trenutni filteri (iz adrese), aktivne kategorije, da li je prijavljen
 * član tima (prikazuje filter „Dodeljen“), spisak agenata (samo admin; agent
 * bira samo „meni“ / „nedodeljeni“) i da li je neki filter uključen.
 * Uloge: customer, agent, admin.
 */
export function TicketFilters({
  query,
  categories,
  isStaff,
  agents,
  filtersActive,
}: {
  query: TicketListQuery;
  categories: Category[];
  isStaff: boolean;
  agents: AgentSummary[];
  filtersActive: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  /**
   * Primena filtera: vrednosti forme -> nova adresa. Strana se vraća na prvu,
   * jer posle promene filtera stara strana možda više ne postoji.
   */
  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const changes: Record<string, string | undefined> = {};
    for (const field of FILTER_FIELDS) {
      const value = data.get(field);
      changes[field] = typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
    }
    router.push(ticketListHref({ ...query, ...changes, page: 1 }));
  }

  return (
    <form
      role="search"
      aria-label={t("tickets.filters.label")}
      onSubmit={(event) => {
        event.preventDefault();
        apply(event.currentTarget);
      }}
      // Promena bilo koje padajuće liste odmah primenjuje filtere.
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) apply(event.currentTarget);
      }}
      className="mb-4 flex flex-col gap-3"
    >
      {/* Pretraga po tekstu ili broju (#1042). */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="q">{t("tickets.filters.search")}</Label>
        <div className="flex gap-2">
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={query.q ?? ""}
            placeholder={t("tickets.filters.searchPlaceholder")}
            maxLength={100}
          />
          <Button type="submit" variant="outline">
            <Search aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t("tickets.filters.searchSubmit")}</span>
          </Button>
        </div>
      </div>

      {/* Padajuće liste: na telefonu dve u redu, na računaru sve u jednom redu. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">{t("tickets.columns.status")}</Label>
          <NativeSelect id="status" name="status" defaultValue={query.status ?? ""}>
            <option value="">{t("tickets.filters.all")}</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`ticketStatus.${status}`)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="priority">{t("tickets.columns.priority")}</Label>
          <NativeSelect id="priority" name="priority" defaultValue={query.priority ?? ""}>
            <option value="">{t("tickets.filters.all")}</option>
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t(`ticketPriority.${priority}`)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="categoryId">{t("tickets.columns.category")}</Label>
          <NativeSelect id="categoryId" name="categoryId" defaultValue={query.categoryId ?? ""}>
            <option value="">{t("tickets.filters.allCategories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryName(category, locale)}
              </option>
            ))}
          </NativeSelect>
        </div>

        {/* Filter po agentu: samo za tim podrške. */}
        {isStaff ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="assigneeId">{t("tickets.columns.assignee")}</Label>
            <NativeSelect id="assigneeId" name="assigneeId" defaultValue={query.assigneeId ?? ""}>
              <option value="">{t("tickets.filters.all")}</option>
              <option value="me">{t("tickets.filters.assigneeMe")}</option>
              <option value="unassigned">{t("tickets.filters.assigneeUnassigned")}</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.fullName}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="sort">{t("tickets.filters.sort")}</Label>
          <NativeSelect id="sort" name="sort" defaultValue={query.sort}>
            {TICKET_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {t(`tickets.sort.${SORT_LABEL_KEYS[sort]}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {filtersActive ? (
        <Button asChild variant="link" size="sm" className="self-start px-0">
          <Link href={ticketListHref({ sort: query.sort })}>{t("tickets.filters.reset")}</Link>
        </Button>
      ) : null}
    </form>
  );
}
