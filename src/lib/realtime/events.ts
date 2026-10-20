/**
 * Fajl: src/lib/realtime/events.ts
 * Svrha: nazivi real-time događaja i kanala, nezavisni od provajdera
 * (Supabase Realtime danas, sopstveni WebSocket server ako ga mentor zatraži).
 * Koriste ga: servisi (slanje događaja posle upisa u bazu) i hook-ovi na
 * klijentu (slušanje). Kanali i ko sme na njih: migracija
 * supabase/migrations/..._realtime_authorization.sql.
 * Povezano sa: CLAUDE.md, sekcija „Real-time sloj“, docs/03, sekcija 4.
 */

/** Događaji koje aplikacija šalje i sluša. */
export const REALTIME_EVENTS = {
  /** Zahtev je izmenjen (status, prioritet, kategorija, naslov...). */
  TICKET_UPDATED: "ticket_updated",
  /** Na zahtevu je dodat komentar. */
  TICKET_COMMENT_ADDED: "ticket_comment_added",
  /** Zahtev je dodeljen ili oslobođen. */
  TICKET_ASSIGNED: "ticket_assigned",
  /** Korisnik je dobio novo obaveštenje (red u tabeli notifications). */
  NOTIFICATION_CREATED: "notification_created",
} as const;

/** Naziv događaja: "ticket_updated" | "ticket_comment_added" | ... */
export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/** Kanal tima podrške (osvežavanje liste zahteva za agente i admine). */
export const STAFF_CHANNEL = "staff";

/** Kanal jednog zahteva: ticket:<id> (vlasnik zahteva i tim podrške). */
export function ticketChannel(ticketId: string): string {
  return `ticket:${ticketId}`;
}

/** Lični kanal korisnika: user:<id> (samo taj korisnik). */
export function userChannel(userId: string): string {
  return `user:${userId}`;
}
