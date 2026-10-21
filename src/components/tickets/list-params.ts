/**
 * Fajl: src/components/tickets/list-params.ts
 * Svrha: filteri liste zahteva u adresi stranice (/tickets?status=open&q=vpn...).
 * Zato što su filteri u adresi, link se može poslati nekome ili sačuvati, a
 * „Nazad“ u pregledaču vraća prethodne filtere.
 *   - parseTicketListParams: adresa -> filteri (ista Zod šema kao API, ticketListQuerySchema)
 *   - ticketListHref: filteri -> adresa (podrazumevane vrednosti se izostavljaju)
 *   - parseTicketView: prikaz liste iz adrese (?view=board = kanban tabla, inače lista)
 * Koriste ga: stranica /tickets (čitanje), TicketFilters, TicketPagination,
 * TicketViewToggle i TicketBoard (pravljenje linkova).
 * Povezano sa: src/lib/validation/tickets.ts, GET /api/tickets (isti parametri).
 */
import { ticketListQuerySchema, type TicketListQuery } from "@/lib/validation/tickets";

/** Parametri adrese kako ih Next.js daje stranici (searchParams). */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Parametri koje lista razume (ostali se zanemaruju). */
const LIST_PARAM_KEYS = [
  "status",
  "priority",
  "categoryId",
  "assigneeId",
  "q",
  "sort",
  "page",
  "pageSize",
] as const;

/**
 * Čita filtere iz adrese.
 * Ulaz: searchParams stranice. Prazne vrednosti (?status=) se tretiraju kao
 * neposlate, kao i u API-ju. Neispravan parametar (npr. ručno upisan
 * ?status=xyz) se zanemaruje, umesto da cela stranica prijavi grešku.
 * Vraća: ispravne filtere sa podrazumevanim vrednostima (strana 1, najnoviji prvo).
 */
export function parseTicketListParams(raw: RawSearchParams): TicketListQuery {
  // Korak 1: samo poznati parametri, prva vrednost ako ih ima više, bez praznih.
  const values: Record<string, string> = {};
  for (const key of LIST_PARAM_KEYS) {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined && first.trim() !== "") values[key] = first;
  }

  // Korak 2: provera Zod šemom; pogrešni parametri se izbacuju i provera ponavlja.
  const result = ticketListQuerySchema.safeParse(values);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete values[key];
  }
  return ticketListQuerySchema.safeParse(values).data ?? ticketListQuerySchema.parse({});
}

/** Prikaz stranice /tickets: lista (podrazumevano) ili kanban tabla. */
export const TICKET_VIEWS = ["list", "board"] as const;
export type TicketView = (typeof TICKET_VIEWS)[number];

/**
 * Čita prikaz iz adrese (?view=board).
 * Vraća: "board" samo za tačnu vrednost "board", inače "list".
 */
export function parseTicketView(raw: RawSearchParams): TicketView {
  const value = Array.isArray(raw.view) ? raw.view[0] : raw.view;
  return value === "board" ? "board" : "list";
}

/** Podrazumevane vrednosti, koje se ne pišu u adresu. */
const DEFAULTS = ticketListQuerySchema.parse({});

/** Filteri i prikaz zajedno (sve što može da stoji u adresi /tickets). */
export type TicketListLocation = Partial<TicketListQuery> & { view?: TicketView };

/**
 * Pravi adresu liste za date filtere.
 * Ulaz: trenutni filteri (i prikaz) i izmene (npr. { page: 2 } ili { status: undefined }).
 * Vraća: npr. "/tickets?status=open&page=2"; bez parametara samo "/tickets".
 * Prikaz „tabla“ dodaje ?view=board (lista je podrazumevana i ne piše se).
 */
export function ticketListHref(
  query: TicketListLocation,
  changes: TicketListLocation = {},
): string {
  const merged: TicketListLocation = { ...query, ...changes };
  const params = new URLSearchParams();
  for (const key of LIST_PARAM_KEYS) {
    const value = merged[key];
    // Preskaču se prazne i podrazumevane vrednosti (kraća, čitljivija adresa).
    if (value === undefined || value === "" || value === DEFAULTS[key]) continue;
    params.set(key, String(value));
  }
  if (merged.view === "board") params.set("view", "board");
  const text = params.toString();
  return text ? `/tickets?${text}` : "/tickets";
}

/**
 * Da li je uključen bar jedan filter ili pretraga (za dugme „Poništi filtere“
 * i za poruku prazne liste).
 */
export function hasActiveFilters(query: TicketListQuery): boolean {
  return Boolean(query.status || query.priority || query.categoryId || query.assigneeId || query.q);
}
