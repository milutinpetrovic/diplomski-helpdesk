/**
 * Fajl: src/services/policies/status-transitions.ts
 * Svrha: StatusTransitionPolicy — tabela dozvoljenih prelaza statusa zahteva
 * po ulogama (FZ-7) i provera da li je neki prelaz dozvoljen.
 * Ovo je primer kontrole pristupa zasnovane na ulogama (RBAC) koji ide i u
 * pisani rad: ista tabela je u docs/02-baza-podataka.md, sekcija 4.
 * Koriste je: TicketService (provera pre promene statusa) i TicketAccessPolicy
 * (polje permissions.allowedTransitions, po kome interfejs prikazuje dugmad).
 * Povezano sa: SQL funkcijom private.is_status_transition_allowed (migracija
 * ..._rpc_tickets.sql). Baza proverava ISTU tabelu i ona je poslednja linija
 * odbrane; ovde je tabela da bi kod dao jasnu grešku i pravu dugmad.
 * Kad se tabela menja, menja se na OBA mesta (unit test pokriva svaki red).
 */
import { AppError } from "@/lib/errors/app-error";
import type { TicketStatus, UserRole } from "@/types/domain";

/** Ko pokušava prelaz: uloga i odnos prema zahtevu. */
export interface TransitionActor {
  /** Uloga prijavljenog korisnika. */
  role: UserRole;
  /** Da li je korisnik vlasnik (podnosilac) zahteva. */
  isOwner: boolean;
  /** Da li je zahtev dodeljen baš ovom korisniku. */
  isAssignee: boolean;
}

/** Jedan red tabele prelaza: iz kog u koji status i koja uloga sme. */
export interface StatusTransitionRule {
  from: TicketStatus;
  to: TicketStatus;
  /** Korisnik sme, ali samo na SVOM zahtevu. */
  customer: boolean;
  /** Agent sme, ali samo na zahtevu koji je DODELJEN njemu. */
  agent: boolean;
  /** Admin sme na svakom zahtevu. */
  admin: boolean;
  /** Objašnjenje reda (za čitaoca koda i za rad). */
  note: string;
}

/**
 * Tabela prelaza (docs/02, sekcija 4). Napomene uz pojedine redove:
 *   - open -> in_progress: agent to ne radi ovde nego PREUZIMANJEM zahteva
 *     (POST /api/tickets/{id}/assign), koje samo prebaci status u in_progress.
 *   - waiting_on_customer -> in_progress: kod korisnika se dešava AUTOMATSKI
 *     kad odgovori komentarom (RPC add_comment), a ne ručnom promenom statusa.
 */
export const STATUS_TRANSITIONS: readonly StatusTransitionRule[] = [
  {
    from: "open",
    to: "in_progress",
    customer: false,
    agent: false,
    admin: true,
    note: "Agent preuzima zahtev preko dodele; admin može i direktno.",
  },
  {
    from: "open",
    to: "closed",
    customer: true,
    agent: false,
    admin: true,
    note: "Korisnik otkazuje svoj zahtev.",
  },
  {
    from: "in_progress",
    to: "waiting_on_customer",
    customer: false,
    agent: true,
    admin: true,
    note: "Agent traži dodatne informacije od korisnika.",
  },
  {
    from: "waiting_on_customer",
    to: "in_progress",
    customer: false,
    agent: true,
    admin: true,
    note: "Kod korisnika automatski, kad odgovori komentarom.",
  },
  {
    from: "in_progress",
    to: "resolved",
    customer: false,
    agent: true,
    admin: true,
    note: "Agent je rešio problem.",
  },
  {
    from: "waiting_on_customer",
    to: "resolved",
    customer: false,
    agent: true,
    admin: true,
    note: "Agent rešava bez čekanja odgovora.",
  },
  {
    from: "resolved",
    to: "closed",
    customer: true,
    agent: false,
    admin: true,
    note: "Korisnik potvrđuje rešenje.",
  },
  {
    from: "resolved",
    to: "in_progress",
    customer: true,
    agent: true,
    admin: true,
    note: "Ponovno otvaranje: rešenje nije pomoglo.",
  },
  {
    from: "closed",
    to: "open",
    customer: false,
    agent: false,
    admin: true,
    note: "Samo admin ponovo otvara zatvoren zahtev.",
  },
];

/** Pravila o statusima zahteva. Čista klasa bez baze, lako se testira. */
export class StatusTransitionPolicy {
  /**
   * Da li akter sme da prebaci zahtev iz statusa `from` u status `to`.
   * Ulaz: trenutni i novi status, akter (uloga, vlasnik, dodeljen).
   * Vraća: true ako postoji red u tabeli koji to dozvoljava njegovoj ulozi.
   */
  canTransition(from: TicketStatus, to: TicketStatus, actor: TransitionActor): boolean {
    // Korak 1: red tabele za ovaj par statusa (ako ga nema, prelaz ne postoji).
    const rule = STATUS_TRANSITIONS.find((r) => r.from === from && r.to === to);
    if (!rule) return false;

    // Korak 2: pravo po ulozi, uz uslov odnosa prema zahtevu.
    switch (actor.role) {
      case "admin":
        return rule.admin;
      case "agent":
        return rule.agent && actor.isAssignee;
      case "customer":
        return rule.customer && actor.isOwner;
    }
  }

  /**
   * Svi statusi u koje akter sme da prebaci zahtev iz statusa `from`.
   * Vraća: niz statusa (prazan ako nema dozvoljenih prelaza); interfejs
   * po njemu prikazuje dugmad (npr. „Potvrdi rešenje“, „Ponovo otvori“).
   */
  allowedTargets(from: TicketStatus, actor: TransitionActor): TicketStatus[] {
    return STATUS_TRANSITIONS.filter(
      (rule) => rule.from === from && this.canTransition(from, rule.to, actor),
    ).map((rule) => rule.to);
  }

  /**
   * Isto kao canTransition, ali baca grešku ako prelaz nije dozvoljen.
   * Baca (istim redom kao baza):
   *   NOT_ASSIGNED_AGENT        - agent menja zahtev koji nije njegov
   *   INVALID_STATUS_TRANSITION - prelaz nije u tabeli za ovu ulogu
   */
  assertTransition(from: TicketStatus, to: TicketStatus, actor: TransitionActor): void {
    if (actor.role === "agent" && !actor.isAssignee) {
      throw new AppError("NOT_ASSIGNED_AGENT");
    }
    if (!this.canTransition(from, to, actor)) {
      throw new AppError("INVALID_STATUS_TRANSITION", { from, to });
    }
  }
}
