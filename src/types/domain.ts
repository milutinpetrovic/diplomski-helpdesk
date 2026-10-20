/**
 * Fajl: src/types/domain.ts
 * Svrha: domenski tipovi aplikacije (uloge, statusi, prioriteti...), čitljiviji
 * oblik tipova generisanih iz baze.
 * Koriste ga: servisi, provera prijave (AuthContext), Zod šeme i komponente.
 * Povezano sa: src/types/database.ts (generisan iz baze, `pnpm db:types`) i
 * docs/03-dijagram-klasa.md, sekcija 2. Tipovi redova (Ticket, Comment...)
 * dodaju se u fazama u kojima se prvi put koriste.
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
