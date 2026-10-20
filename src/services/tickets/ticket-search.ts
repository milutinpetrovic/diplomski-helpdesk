/**
 * Fajl: src/services/tickets/ticket-search.ts
 * Svrha: pretvara tekst iz polja za pretragu (parametar q na GET /api/tickets)
 * u upit za bazu (FZ-10):
 *   - "#1042" ili "1042"  -> traži zahtev po broju
 *   - "štampač kanc"      -> zahtevi čiji naslov ili opis sadrži reči koje
 *                            POČINJU sa „štampač“ I sa „kanc“
 * Tekst se pretražuje kroz kolonu tickets.search_vector (GIN indeks,
 * migracija ..._tickets.sql), funkcijom to_tsquery('simple', ...).
 * Koristi ga: TicketService.list. Čista funkcija, ima unit test.
 */

/** Rezultat obrade teksta za pretragu. */
export type TicketSearch =
  { kind: "number"; number: number } | { kind: "text"; tsquery: string } | { kind: "none" };

/** Najviše reči koje se uzimaju u obzir (zaštita od predugačkih upita). */
const MAX_TERMS = 8;

/**
 * Ulaz: tekst koji je korisnik upisao (već skraćen na 100 znakova u Zod šemi).
 * Vraća: pretragu po broju, tekstualni upit za to_tsquery ili "none".
 * Iz reči se izbacuje sve osim slova i cifara, pa korisnik ne može da
 * ubaci posebne znakove to_tsquery jezika (&, |, !, :, zagrade).
 */
export function parseTicketSearch(q: string | undefined): TicketSearch {
  const text = q?.trim() ?? "";

  // Korak 1: broj zahteva (#1042 ili samo 1042).
  const numberMatch = /^#?(\d{1,12})$/.exec(text);
  if (numberMatch) return { kind: "number", number: Number(numberMatch[1]) };

  // Korak 2: reči od slova i cifara (radi i sa č, ć, š, đ, ž), mala slova.
  const terms = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_TERMS);
  if (terms.length === 0) return { kind: "none" };

  // Korak 3: svaka reč kao početak reči (:*), sve reči moraju postojati (&).
  return { kind: "text", tsquery: terms.map((term) => `${term}:*`).join(" & ") };
}
