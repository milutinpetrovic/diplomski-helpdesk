/**
 * Fajl: src/app/(app)/tickets/page.tsx
 * Svrha: stranica /tickets — lista zahteva (UC-10, UC-15, UC-19):
 *   - korisnik vidi „Moji zahtevi“ (samo svoje; to obezbeđuje RLS u bazi)
 *   - agent i admin vide „Zahtevi“ (sve), sa filterom po dodeljenom agentu
 *   - pretraga, filteri i sortiranje su u adresi (?status=open&q=vpn&page=2)
 * Podaci se čitaju na serveru preko istog servisa kao GET /api/tickets
 * (TicketService.list), pa važe ista pravila i ista provera parametara.
 * Pristup: customer, agent, admin.
 * Povezano sa: TicketFilters, TicketList, TicketPagination, list-params.ts.
 */
import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/PageHeader";
import { TicketFilters } from "@/components/tickets/TicketFilters";
import { TicketList } from "@/components/tickets/TicketList";
import { TicketPagination } from "@/components/tickets/TicketPagination";
import {
  hasActiveFilters,
  parseTicketListParams,
  ticketListHref,
} from "@/components/tickets/list-params";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/server-session";
import { UserAdminService } from "@/services/admin/user-admin-service";
import { CategoryService } from "@/services/categories/category-service";
import { TicketService } from "@/services/tickets/ticket-service";

/** Naslov taba: „Moji zahtevi“ ili „Zahtevi“ (po ulozi). */
export async function generateMetadata() {
  const { profile } = await requireCurrentUser();
  const t = await getTranslations("tickets.list");
  return { title: profile.role === "customer" ? t("titleCustomer") : t("titleStaff") };
}

/** Lista zahteva (serverska komponenta; filteri su klijentski). */
export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const { ctx, profile } = await requireCurrentUser();
  const t = await getTranslations("tickets.list");
  const isCustomer = profile.role === "customer";

  // Korak 1: filteri iz adrese (neispravni parametri se zanemaruju).
  const query = parseTicketListParams(await searchParams);

  // Korak 2: zahtevi, kategorije za filter i (za tim) spisak agenata, paralelno.
  const [page, categories, agents] = await Promise.all([
    new TicketService(ctx).list(query),
    new CategoryService(ctx).listActive(),
    isCustomer ? Promise.resolve([]) : new UserAdminService(ctx).listAgents(),
  ]);
  const filtersActive = hasActiveFilters(query);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={isCustomer ? t("titleCustomer") : t("titleStaff")}
          description={isCustomer ? t("descriptionCustomer") : t("descriptionStaff")}
        />
        {/* Novi zahtev prijavljuje samo korisnik (POST /api/tickets je samo za customer). */}
        {isCustomer ? (
          <Button asChild className="mb-6 self-start">
            <Link href="/tickets/new">
              <Plus aria-hidden="true" />
              {t("newTicket")}
            </Link>
          </Button>
        ) : null}
      </div>

      {/* key: forma se ponovo pravi kad se filteri promene (npr. „Poništi filtere“). */}
      <TicketFilters
        key={ticketListHref(query)}
        query={query}
        categories={categories}
        isStaff={!isCustomer}
        agents={agents}
        filtersActive={filtersActive}
      />

      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        {t("total", { total: page.total })}
      </p>

      {page.items.length > 0 ? (
        <TicketList items={page.items} showCreator={!isCustomer} />
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {isCustomer && !filtersActive ? t("emptyCustomer") : t("empty")}
        </p>
      )}

      <TicketPagination query={query} total={page.total} />
    </>
  );
}
