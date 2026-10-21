/**
 * Fajl: src/services/tickets/ticket-service.ts
 * Svrha: TicketService — poslovna logika zahteva (tiketa):
 *   - lista sa filterima, pretragom, sortiranjem i paginacijom (UC-10, UC-15, UC-19)
 *   - detalji sa dozvoljenim akcijama (UC-11)
 *   - kreiranje (UC-09), izmena, promena statusa (UC-13, UC-17)
 *   - dodela / preuzimanje (UC-16, UC-20) i istorija promena (FZ-9)
 * Čitanje ide direktno iz tabela (RLS u bazi filtrira šta korisnik sme da
 * vidi), a svaka izmena kroz RPC funkciju koja u jednoj transakciji upisuje
 * promenu, istoriju i obaveštenja. Pre RPC poziva servis proverava pravila
 * (StatusTransitionPolicy, TicketAccessPolicy), da bi greška bila jasna;
 * baza iste provere ponavlja kao poslednja linija odbrane.
 * Koriste ga: API rute src/app/api/tickets/** (a u Fazi 5b i serverske stranice).
 * Povezano sa: docs/03 (klasa TicketService), docs/06 (rute Zahtevi),
 * supabase/migrations/..._rpc_tickets.sql.
 */
import { AppError, fromDbError } from "@/lib/errors/app-error";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import type { Paginated } from "@/lib/validation/common";
import {
  UNRESOLVED_FILTER,
  type CreateTicketInput,
  type Ticket,
  type TicketDetail,
  type TicketHistoryEntry,
  type TicketListItem,
  type TicketListQuery,
  type TicketSort,
  type UpdateTicketInput,
} from "@/lib/validation/tickets";
import type { TicketRating } from "@/lib/validation/ratings";
import { StatusTransitionPolicy } from "@/services/policies/status-transitions";
import { TicketAccessPolicy, type EditableTicketField } from "@/services/policies/ticket-access";
import type { ServiceContext } from "@/services/service-context";
import { loadCategories, loadProfileSummaries, pick } from "@/services/shared/lookups";
import { publishTicketEvent } from "@/services/shared/publish";
import { parseTicketSearch } from "@/services/tickets/ticket-search";
import { UNRESOLVED_TICKET_STATUSES, type TicketStatus } from "@/types/domain";
import type { Database, Json } from "@/types/database";

/** Red tabele tickets, kako ga vraća Supabase. */
export type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];

/** Red tabele ticket_ratings. */
type RatingRow = Database["public"]["Tables"]["ticket_ratings"]["Row"];

/** Kolone zahteva koje API vraća (bez search_vector, koji služi samo za pretragu). */
export const TICKET_COLUMNS =
  "id, number, title, description, status, priority, category_id, created_by, assigned_to, " +
  "first_response_at, resolved_at, closed_at, created_at, updated_at";

/** Red zahteva bez kolone za pretragu. */
type TicketColumns = Omit<TicketRow, "search_vector">;

/** Sortiranje iz API-ja -> kolona u bazi i smer. */
const SORT_COLUMNS: Record<TicketSort, { column: string; ascending: boolean }> = {
  "-createdAt": { column: "created_at", ascending: false },
  createdAt: { column: "created_at", ascending: true },
  "-updatedAt": { column: "updated_at", ascending: false },
  updatedAt: { column: "updated_at", ascending: true },
  "-priority": { column: "priority", ascending: false },
  priority: { column: "priority", ascending: true },
};

/** Pretvara red zahteva (snake_case) u oblik za API (camelCase). */
export function toTicket(row: TicketColumns): Ticket {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    categoryId: row.category_id,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    firstResponseAt: row.first_response_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Pretvara red ocene u oblik za API. */
export function toRating(row: RatingRow): TicketRating {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    ratedBy: row.rated_by,
    score: row.score,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

/** JSON vrednost iz istorije kao objekat (ili null). */
function asRecord(value: Json | null): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/**
 * Učitava jedan zahtev koji prijavljeni korisnik sme da vidi.
 * Baca TICKET_NOT_FOUND i kad zahtev ne postoji i kad je tuđ (RLS ga ne
 * vraća), da se ne otkrije da tuđi zahtev postoji.
 * Koriste je i CommentService i RatingService.
 */
export async function loadVisibleTicket(ctx: ServiceContext, id: string): Promise<Ticket> {
  const { data, error } = await ctx.db
    .from("tickets")
    .select(TICKET_COLUMNS)
    .eq("id", id)
    .maybeSingle<TicketColumns>();
  if (error) throw fromDbError(error);
  if (!data) throw new AppError("TICKET_NOT_FOUND");
  return toTicket(data);
}

/** Servis za zahteve. Uloge: svi prijavljeni; svaka metoda navodi svoja pravila. */
export class TicketService {
  private readonly access: TicketAccessPolicy;

  /**
   * Ulaz: ServiceContext i, opciono, politike (zamenljive u testovima).
   */
  constructor(
    private readonly ctx: ServiceContext,
    private readonly transitions = new StatusTransitionPolicy(),
    access?: TicketAccessPolicy,
  ) {
    this.access = access ?? new TicketAccessPolicy(transitions);
  }

  /**
   * Lista zahteva (GET /api/tickets).
   * Ulaz: filteri, pretraga, sortiranje i stranica (ticketListQuerySchema).
   * Vraća: stranicu zahteva sa kategorijom, podnosiocem i dodeljenim agentom.
   * Uloge: korisnik dobija samo svoje zahteve; agent i admin sve.
   */
  async list(query: TicketListQuery): Promise<Paginated<TicketListItem>> {
    const { page, pageSize } = query;
    const from = (page - 1) * pageSize;

    // Korak 1: upit sa filterima i ukupnim brojem (count) za paginaciju.
    let request = this.ctx.db.from("tickets").select(TICKET_COLUMNS, { count: "exact" });

    // Korisnik vidi samo svoje (to garantuje i RLS; ovde je i eksplicitno).
    if (!this.ctx.auth.isStaff()) request = request.eq("created_by", this.ctx.auth.userId);
    // Status: jedan status ili „unresolved“ (svi nerešeni, filter sa kontrolnog panela).
    if (query.status === UNRESOLVED_FILTER) {
      request = request.in("status", [...UNRESOLVED_TICKET_STATUSES]);
    } else if (query.status) {
      request = request.eq("status", query.status);
    }
    if (query.priority) request = request.eq("priority", query.priority);
    if (query.categoryId) request = request.eq("category_id", query.categoryId);
    if (query.assigneeId === "me") request = request.eq("assigned_to", this.ctx.auth.userId);
    else if (query.assigneeId === "unassigned") request = request.is("assigned_to", null);
    else if (query.assigneeId) request = request.eq("assigned_to", query.assigneeId);

    // Korak 2: pretraga (po broju zahteva ili po rečima iz naslova i opisa).
    const search = parseTicketSearch(query.q);
    if (search.kind === "number") request = request.eq("number", search.number);
    if (search.kind === "text") {
      request = request.textSearch("search_vector", search.tsquery, { config: "simple" });
    }

    // Korak 3: sortiranje (uz broj zahteva kao drugi kriterijum, da redosled
    // bude stabilan) i stranica.
    const sort = SORT_COLUMNS[query.sort];
    const { data, error, count } = await request
      .order(sort.column, { ascending: sort.ascending })
      .order("number", { ascending: false })
      .range(from, from + pageSize - 1)
      .overrideTypes<TicketColumns[], { merge: false }>();

    // Stranica posle poslednje (npr. ?page=99): PostgREST vraća grešku
    // PGRST103; to nije greška korisnika, nego prazna stranica.
    if (error?.code === "PGRST103") {
      return { items: [], page, pageSize, total: await this.countAfterRangeError(query) };
    }
    if (error) throw fromDbError(error);

    // Korak 4: povezani podaci (kategorije i imena) za sve zahteve odjednom.
    const rows = data ?? [];
    const [categories, people] = await Promise.all([
      loadCategories(
        this.ctx.db,
        rows.map((row) => row.category_id),
      ),
      loadProfileSummaries(
        this.ctx.db,
        rows.flatMap((row) => [row.created_by, row.assigned_to]),
      ),
    ]);

    // Korak 5: oblik za API.
    const items = rows.map((row) => ({
      id: row.id,
      number: row.number,
      title: row.title,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      category: pick(categories, row.category_id),
      creator: pick(people, row.created_by),
      assignee: pick(people, row.assigned_to),
    }));
    return { items, page, pageSize, total: count ?? items.length };
  }

  /**
   * Ukupan broj zahteva kad je tražena stranica posle poslednje
   * (PostgREST tada ne vraća count). Isti filteri, bez stranice.
   */
  private async countAfterRangeError(query: TicketListQuery): Promise<number> {
    const firstPage = await this.list({ ...query, page: 1, pageSize: 1 });
    return firstPage.total;
  }

  /**
   * Detalji zahteva (GET /api/tickets/{id}).
   * Vraća: zahtev + kategorija, podnosilac, dodeljeni agent, ocena i
   * permissions (šta prijavljeni korisnik sme; po tome UI prikazuje dugmad).
   * Baca: TICKET_NOT_FOUND (ne postoji ili je tuđ).
   * Uloge: vlasnik zahteva, agent, admin.
   */
  async getById(id: string): Promise<TicketDetail> {
    const ticket = await loadVisibleTicket(this.ctx, id);
    return this.toDetail(ticket);
  }

  /**
   * Novi zahtev (POST /api/tickets).
   * Ulaz: naslov, opis, kategorija, prioritet (createTicketSchema).
   * Vraća: detalje novog zahteva (status open, nedodeljen).
   * Uloge: samo customer (proverava ruta i RPC create_ticket).
   * Obaveštenje timu podrške upisuje sama baza (ticket_created).
   */
  async create(input: CreateTicketInput): Promise<TicketDetail> {
    // Korak 1: upis kroz RPC (zahtev + istorija + obaveštenja timu).
    const { data, error } = await this.ctx.db
      .rpc("create_ticket", {
        p_title: input.title,
        p_description: input.description,
        p_category_id: input.categoryId,
        p_priority: input.priority,
      })
      .single<TicketColumns>();
    if (error) throw fromDbError(error);

    // Korak 2: odgovor sa dozvolama. Real-time događaj se ne šalje: korisnik
    // nema pravo slanja na kanal tima, a tim saznaje preko obaveštenja.
    return this.toDetail(toTicket(data));
  }

  /**
   * Izmena zahteva (PATCH /api/tickets/{id}).
   * Ulaz: polja za izmenu (bar jedno, updateTicketSchema).
   * Pravila: korisnik samo naslov i opis svog otvorenog zahteva; agent samo
   * dodeljen zahtev; admin sve; zatvoren zahtev se ne menja.
   * Vraća: ažurirane detalje. Baca: TICKET_NOT_FOUND, TICKET_CLOSED,
   * NOT_ASSIGNED_AGENT, FORBIDDEN, VALIDATION_ERROR (neaktivna kategorija).
   */
  async update(id: string, input: UpdateTicketInput): Promise<TicketDetail> {
    // Korak 1: zahtev i provera prava za tačno ta polja.
    const ticket = await loadVisibleTicket(this.ctx, id);
    const fields = (Object.keys(input) as EditableTicketField[]).filter(
      (field) => input[field] !== undefined,
    );
    this.access.assertCanEdit(ticket, this.ctx.auth, fields);

    // Korak 2: izmena kroz RPC (polje koje nije poslato ostaje isto).
    const { data, error } = await this.ctx.db
      .rpc("update_ticket", {
        p_ticket_id: id,
        p_title: input.title,
        p_description: input.description,
        p_category_id: input.categoryId,
        p_priority: input.priority,
      })
      .single<TicketColumns>();
    if (error) throw fromDbError(error);

    // Korak 3: real-time događaj i odgovor.
    await publishTicketEvent(this.ctx, REALTIME_EVENTS.TICKET_UPDATED, id);
    return this.toDetail(toTicket(data));
  }

  /**
   * Promena statusa (POST /api/tickets/{id}/status).
   * Ulaz: ID zahteva i novi status.
   * Pravila: tabela prelaza (StatusTransitionPolicy); baza postavlja
   * resolved_at / closed_at i upisuje istoriju i obaveštenja.
   * Vraća: ažurirane detalje. Baca: TICKET_NOT_FOUND, NOT_ASSIGNED_AGENT,
   * INVALID_STATUS_TRANSITION.
   * Uloge: korisnik (svoj zahtev), agent (dodeljen), admin.
   */
  async changeStatus(id: string, to: TicketStatus): Promise<TicketDetail> {
    // Korak 1: zahtev i provera prelaza po tabeli.
    const ticket = await loadVisibleTicket(this.ctx, id);
    this.transitions.assertTransition(
      ticket.status,
      to,
      this.access.actorFor(ticket, this.ctx.auth),
    );

    // Korak 2: promena kroz RPC.
    const { data, error } = await this.ctx.db
      .rpc("change_ticket_status", { p_ticket_id: id, p_new_status: to })
      .single<TicketColumns>();
    if (error) throw fromDbError(error);

    // Korak 3: real-time događaj i odgovor.
    await publishTicketEvent(this.ctx, REALTIME_EVENTS.TICKET_UPDATED, id);
    return this.toDetail(toTicket(data));
  }

  /**
   * Dodela zahteva (POST /api/tickets/{id}/assign).
   * Ulaz: ID zahteva i ID člana tima (null = oslobađanje, samo admin).
   * Pravila: agent samo sebi i samo nedodeljen zahtev (preuzimanje); admin
   * bilo kom aktivnom agentu/adminu. Dodela otvorenog zahteva ga prebacuje
   * u in_progress (radi baza).
   * Vraća: ažurirane detalje. Baca: TICKET_NOT_FOUND, TICKET_CLOSED,
   * FORBIDDEN, TICKET_ALREADY_ASSIGNED, ASSIGNEE_NOT_AGENT.
   * Uloge: agent, admin.
   */
  async assign(id: string, assigneeId: string | null): Promise<TicketDetail> {
    // Korak 1: zahtev i provera prava.
    const ticket = await loadVisibleTicket(this.ctx, id);
    this.access.assertCanAssign(ticket, this.ctx.auth, assigneeId);

    // Korak 2: dodela kroz RPC (bez p_assignee_id = oslobađanje).
    const { data, error } = await this.ctx.db
      .rpc("assign_ticket", {
        p_ticket_id: id,
        ...(assigneeId ? { p_assignee_id: assigneeId } : {}),
      })
      .single<TicketColumns>();
    if (error) throw fromDbError(error);

    // Korak 3: real-time događaj i odgovor.
    await publishTicketEvent(this.ctx, REALTIME_EVENTS.TICKET_ASSIGNED, id);
    return this.toDetail(toTicket(data));
  }

  /**
   * Istorija promena zahteva (GET /api/tickets/{id}/history), od najstarije.
   * Vraća: stavke sa imenom aktera (null = sistem) i, za dodelu, imenom agenta.
   * Istorija ne sadrži tekst komentara, pa je korisnik sme videti celu.
   * Baca: TICKET_NOT_FOUND. Uloge: vlasnik zahteva, agent, admin.
   */
  async getHistory(id: string): Promise<TicketHistoryEntry[]> {
    // Korak 1: pristup zahtevu (jasna greška 404 umesto prazne liste).
    await loadVisibleTicket(this.ctx, id);

    // Korak 2: stavke istorije.
    const { data, error } = await this.ctx.db
      .from("ticket_history")
      .select("id, actor_id, action, old_value, new_value, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    if (error) throw fromDbError(error);

    // Korak 3: imena aktera i agenata iz stavki dodele (assigned_to u vrednostima).
    const assigneeOf = (entry: (typeof data)[number]): string | null => {
      if (entry.action !== "assigned" && entry.action !== "unassigned") return null;
      const values = entry.action === "assigned" ? entry.new_value : entry.old_value;
      const assignedTo = asRecord(values)?.assigned_to;
      return typeof assignedTo === "string" ? assignedTo : null;
    };
    const people = await loadProfileSummaries(
      this.ctx.db,
      data.flatMap((entry) => [entry.actor_id, assigneeOf(entry)]),
    );

    // Korak 4: oblik za API.
    return data.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor: pick(people, entry.actor_id),
      assignee: pick(people, assigneeOf(entry)),
      oldValue: asRecord(entry.old_value),
      newValue: asRecord(entry.new_value),
      createdAt: entry.created_at,
    }));
  }

  /**
   * Pravi odgovor sa detaljima: dodaje kategoriju, imena, ocenu i dozvole.
   * Ulaz: zahtev koji je pozivalac već video (RLS) ili upravo izmenio.
   */
  private async toDetail(ticket: Ticket): Promise<TicketDetail> {
    // Korak 1: povezani podaci paralelno.
    const [categories, people, ratingResult] = await Promise.all([
      loadCategories(this.ctx.db, [ticket.categoryId]),
      loadProfileSummaries(this.ctx.db, [ticket.createdBy, ticket.assignedTo]),
      this.ctx.db
        .from("ticket_ratings")
        .select("id, ticket_id, rated_by, score, comment, created_at")
        .eq("ticket_id", ticket.id)
        .maybeSingle(),
    ]);
    if (ratingResult.error) throw fromDbError(ratingResult.error);
    const rating = ratingResult.data ? toRating(ratingResult.data) : null;

    // Korak 2: dozvole prijavljenog korisnika (TicketAccessPolicy).
    return {
      ...ticket,
      category: pick(categories, ticket.categoryId),
      creator: pick(people, ticket.createdBy),
      assignee: pick(people, ticket.assignedTo),
      rating,
      permissions: this.access.permissionsFor(ticket, this.ctx.auth, rating !== null),
    };
  }
}
