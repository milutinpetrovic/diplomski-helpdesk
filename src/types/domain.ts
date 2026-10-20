/**
 * Fajl: src/types/domain.ts
 * Svrha: domenski tipovi aplikacije (uloge, statusi, prioriteti...), čitljiviji
 * oblik tipova generisanih iz baze.
 * Koriste ga: servisi, provera prijave (AuthContext), Zod šeme i komponente.
 * Povezano sa: src/types/database.ts (generisan iz baze, `pnpm db:types`) i
 * docs/03-dijagram-klasa.md, sekcija 2. Tipovi redova u odgovorima API-ja
 * (Ticket, TicketComment...) izvode se iz Zod šema u src/lib/validation/.
 */
import type { Database } from "@/types/database";

/** Skraćenica za enum tipove iz baze. */
type DbEnums = Database["public"]["Enums"];

/** Uloga korisnika: customer (korisnik), agent ili admin. */
export type UserRole = DbEnums["user_role"];

/** Status zahteva (open, in_progress, waiting_on_customer, resolved, closed). */
export type TicketStatus = DbEnums["ticket_status"];

/** Prioritet zahteva (low, medium, high, urgent). */
export type TicketPriority = DbEnums["ticket_priority"];

/** Vrsta stavke u istoriji zahteva. */
export type HistoryAction = DbEnums["history_action"];

/** Vrsta obaveštenja. */
export type NotificationType = DbEnums["notification_type"];

/** Sve uloge, redom; koristi se npr. za Zod šeme i padajuće liste. */
export const USER_ROLES = ["customer", "agent", "admin"] as const satisfies readonly UserRole[];

/** Uloge tima podrške (agent i admin). */
export const STAFF_ROLES = ["agent", "admin"] as const satisfies readonly UserRole[];

/** Svi statusi zahteva, redom kojim zahtev prolazi kroz obradu. */
export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
] as const satisfies readonly TicketStatus[];

/** Svi prioriteti, od najnižeg do najvišeg (isti redosled kao enum u bazi). */
export const TICKET_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const satisfies readonly TicketPriority[];

/** Sve vrste stavki u istoriji zahteva. */
export const HISTORY_ACTIONS = [
  "created",
  "status_changed",
  "assigned",
  "unassigned",
  "priority_changed",
  "category_changed",
  "updated",
  "rated",
] as const satisfies readonly HistoryAction[];
