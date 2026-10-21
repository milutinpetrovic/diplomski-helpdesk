/**
 * Fajl: src/app/(app)/tickets/page.tsx
 * Svrha: stranica /tickets — lista zahteva (UC-10, UC-15, UC-19):
 *   - korisnik vidi „Moji zahtevi“ (samo svoje; to obezbeđuje RLS u bazi)
 *   - agent i admin vide „Zahtevi“ (sve), sa filterom po dodeljenom agentu
 *   - pretraga, filteri i sortiranje su u adresi (?status=open&q=vpn&page=2)
 *   - dva prikaza (prekidač „Lista / Tabla“): lista sa stranama ili kanban
 *     tabla (?view=board) sa kolonom za svaki status i prevlačenjem kartica
 * Podaci se čitaju na serveru preko istog servisa kao GET /api/tickets
 * (TicketService.list), pa važe ista pravila i ista provera parametara.
 * Tabla učitava pet kolona paralelno (svaka = jedan status, najviše
 * BOARD_COLUMN_LIMIT zahteva), uz iste filtere osim statusa.
 * Pristup: customer, agent, admin.
 * Povezano sa: TicketFilters, TicketViewToggle, TicketList, TicketPagination,
 * TicketBoard, list-params.ts, board-rules.ts.
 */
import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/PageHeader";
import { TicketBoard } from "@/components/tickets/TicketBoard";
import { TicketFilters } from "@/components/tickets/TicketFilters";
import { TicketList } from "@/components/tickets/TicketList";
import { TicketPagination } from "@/components/tickets/TicketPagination";
import { TicketViewToggle } from "@/components/tickets/TicketViewToggle";
import {
  BOARD_COLUMNS,
  BOARD_COLUMN_LIMIT,
  type BoardColumnData,
} from "@/components/tickets/board-rules";
import {
  hasActiveFilters,
  parseTicketListParams,
  parseTicketView,
  ticketListHref,
} from "@/components/tickets/list-params";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/server-session";
import type { TicketListQuery } from "@/lib/validation/tickets";
import { UserAdminService } from "@/services/admin/user-admin-service";
import { CategoryService } from "@/services/categories/category-service";
import { TicketService } from "@/services/tickets/ticket-service";

/** Naslov taba: „Moji zahtevi“ ili „Zahtevi“ (po ulozi). */
export async function generateMetadata() {
  const { profile } = await requireCurrentUser();
  const t = await getTranslations("tickets.list");
  return { title: profile.role === "customer" ? t("titleCustomer") : t("titleStaff") };
}

/**
 * Učitava kolone kanban table: za svaki status prva strana zahteva sa istim
 * filterima (bez filtera statusa), paralelno.
 * Ulaz: servis zahteva i filteri iz adrese. Vraća: pet kolona za TicketBoard.
 */
async function loadBoardColumns(
  service: TicketService,
  query: TicketListQuery,
): Promise<BoardColumnData[]> {
  return Promise.all(
    BOARD_COLUMNS.map(async (status) => {
      const page = await service.list({ ...query, status, page: 1, pageSize: BOARD_COLUMN_LIMIT });
      return {
        status,
        items: page.items,
        total: page.total,
        // „Prikaži sve“ vodi na listu sa istim filterima i ovim statusom.
        showAllHref: ticketListHref(query, { status, page: 1, view: "list" }),
      };
    }),
  );
}

/** Lista zahteva (serverska komponenta; filteri i tabla su klijentski). */
export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const { ctx, profile } = await requireCurrentUser();
  const t = await getTranslations("tickets.list");
  const isCustomer = profile.role === "customer";

  // Korak 1: filteri i prikaz iz adrese (neispravni parametri se zanemaruju).
  // Na tabli se filter statusa ne koristi, jer su statusi kolone.
  const raw = await searchParams;
  const view = parseTicketView(raw);
  const parsed = parseTicketListParams(raw);
  const query = view === "board" ? { ...parsed, status: undefined, page: 1 } : parsed;
  const service = new TicketService(ctx);

  // Korak 2: zahtevi (strana liste ili kolone table), kategorije za filter i
  // (za tim) spisak agenata, paralelno.
  const [page, board, categories, agents] = await Promise.all([
    view === "list" ? service.list(query) : Promise.resolve(null),
    view === "board" ? loadBoardColumns(service, query) : Promise.resolve(null),
    new CategoryService(ctx).listActive(),
    isCustomer ? Promise.resolve([]) : new UserAdminService(ctx).listAgents(),
  ]);
  const filtersActive = hasActiveFilters(query);
  const total = page?.total ?? board?.reduce((sum, column) => sum + column.total, 0) ?? 0;

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

      <TicketViewToggle query={query} view={view} />

      {/* key: forma se ponovo pravi kad se filteri ili prikaz promene (npr. „Poništi filtere“). */}
      <TicketFilters
        key={ticketListHref(query, { view })}
        query={query}
        view={view}
        categories={categories}
        isStaff={!isCustomer}
        agents={agents}
        filtersActive={filtersActive}
      />

      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        {t("total", { total })}
      </p>

      {/* Tabla: kolone po statusu, sa prevlačenjem (i kad je prazna, da se vide kolone). */}
      {board ? (
        <TicketBoard
          columns={board}
          user={{ id: profile.id, role: profile.role }}
          showCreator={!isCustomer}
        />
      ) : null}

      {/* Lista: strana zahteva i paginacija. */}
      {page ? (
        <>
          {page.items.length > 0 ? (
            <TicketList items={page.items} showCreator={!isCustomer} />
          ) : (
            <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              {isCustomer && !filtersActive ? t("emptyCustomer") : t("empty")}
            </p>
          )}
          <TicketPagination query={query} total={page.total} />
        </>
      ) : null}
    </>
  );
}
