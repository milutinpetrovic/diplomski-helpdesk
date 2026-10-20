/**
 * Fajl: src/services/policies/ticket-access.ts
 * Svrha: TicketAccessPolicy — ko sme šta da radi sa jednim zahtevom: da ga
 * vidi, komentariše (javno ili interno), dodeli, izmeni ili oceni.
 * Iz ove klase nastaje polje `permissions` u odgovoru GET /api/tickets/{id},
 * pa interfejs prikazuje samo dugmad koja korisnik zaista sme da koristi.
 * Koriste je: TicketService, CommentService, RatingService.
 * Povezano sa: RLS politikama i RPC funkcijama u bazi (iste provere; baza je
 * poslednja linija odbrane), StatusTransitionPolicy, docs/03 (klasa
 * TicketAccessPolicy) i docs/06 (polje permissions).
 */
import type { AuthContext } from "@/lib/auth/auth-context";
import { AppError } from "@/lib/errors/app-error";
import {
  StatusTransitionPolicy,
  type TransitionActor,
} from "@/services/policies/status-transitions";
import type { TicketStatus } from "@/types/domain";

/** Podaci o zahtevu koji su potrebni za odluku (deo reda tabele tickets). */
export interface TicketAccessInfo {
  status: TicketStatus;
  /** Vlasnik (podnosilac) zahteva. */
  createdBy: string;
  /** Dodeljeni agent/admin ili null. */
  assignedTo: string | null;
}

/** Šta prijavljeni korisnik sme sa zahtevom (polje permissions u API-ju). */
export interface TicketPermissions {
  /** Statusi u koje sme ručno da prebaci zahtev. */
  allowedTransitions: TicketStatus[];
  /** Sme da doda javni komentar. */
  canComment: boolean;
  /** Sme da doda internu belešku (vidi je samo tim podrške). */
  canCommentInternal: boolean;
  /** Sme da dodeli zahtev: agent sebi (preuzimanje), admin bilo kom članu tima. */
  canAssign: boolean;
  /** Sme da oceni rešenje (CSAT). */
  canRate: boolean;
  /** Sme da izmeni zahtev (korisnik samo naslov i opis dok je zahtev otvoren). */
  canEdit: boolean;
}

/** Polja zahteva koja se menjaju preko PATCH /api/tickets/{id}. */
export type EditableTicketField = "title" | "description" | "categoryId" | "priority";

/** Pravila pristupa zahtevu. Čista klasa bez baze, lako se testira. */
export class TicketAccessPolicy {
  /** Ulaz: politika statusa (može se zameniti u testovima). */
  constructor(private readonly transitions = new StatusTransitionPolicy()) {}

  /** Akter za tabelu prelaza: uloga + da li je vlasnik / dodeljen. */
  actorFor(ticket: TicketAccessInfo, auth: AuthContext): TransitionActor {
    return {
      role: auth.role,
      isOwner: ticket.createdBy === auth.userId,
      isAssignee: ticket.assignedTo === auth.userId,
    };
  }

  /** Vidi zahtev: vlasnik ili tim podrške (isto kao RLS politika na tickets). */
  canView(ticket: TicketAccessInfo, auth: AuthContext): boolean {
    return auth.isStaff() || ticket.createdBy === auth.userId;
  }

  /**
   * Sme da komentariše: svako ko vidi zahtev, dok zahtev nije zatvoren.
   * Interna beleška: samo tim podrške.
   */
  canComment(ticket: TicketAccessInfo, auth: AuthContext, isInternal: boolean): boolean {
    if (!this.canView(ticket, auth) || ticket.status === "closed") return false;
    return isInternal ? auth.isStaff() : true;
  }

  /**
   * Sme da dodeli zahtev (zatvoren se ne dodeljuje):
   *   - admin: bilo kom aktivnom članu tima, ili da oslobodi zahtev
   *   - agent: samo sebi, i samo nedodeljen zahtev (preuzimanje)
   * Ulaz assigneeId: kome se dodeljuje (null = oslobađanje); bez njega se
   * pita opšte pitanje „da li postoji dodela koju sme“ (za dugme u UI-u).
   */
  canAssign(ticket: TicketAccessInfo, auth: AuthContext, assigneeId?: string | null): boolean {
    if (ticket.status === "closed") return false;
    if (auth.isAdmin()) return true;
    if (auth.role !== "agent" || ticket.assignedTo !== null) return false;
    return assigneeId === undefined || assigneeId === auth.userId;
  }

  /**
   * Sme da oceni: samo vlasnik, kad je zahtev rešen ili zatvoren, i samo
   * ako ocena još ne postoji.
   */
  canRate(ticket: TicketAccessInfo, auth: AuthContext, hasRating: boolean): boolean {
    return (
      ticket.createdBy === auth.userId &&
      (ticket.status === "resolved" || ticket.status === "closed") &&
      !hasRating
    );
  }

  /**
   * Sme da izmeni zahtev (zatvoren se ne menja):
   *   - admin: svaki zahtev
   *   - agent: samo zahtev koji mu je dodeljen
   *   - korisnik: svoj zahtev dok je otvoren (samo naslov i opis, vidi assertCanEdit)
   */
  canEdit(ticket: TicketAccessInfo, auth: AuthContext): boolean {
    if (ticket.status === "closed") return false;
    switch (auth.role) {
      case "admin":
        return true;
      case "agent":
        return ticket.assignedTo === auth.userId;
      case "customer":
        return ticket.createdBy === auth.userId && ticket.status === "open";
    }
  }

  /** Sva prava odjednom (polje permissions u odgovoru API-ja). */
  permissionsFor(
    ticket: TicketAccessInfo,
    auth: AuthContext,
    hasRating: boolean,
  ): TicketPermissions {
    return {
      allowedTransitions: this.transitions.allowedTargets(
        ticket.status,
        this.actorFor(ticket, auth),
      ),
      canComment: this.canComment(ticket, auth, false),
      canCommentInternal: this.canComment(ticket, auth, true),
      canAssign: this.canAssign(ticket, auth),
      canRate: this.canRate(ticket, auth, hasRating),
      canEdit: this.canEdit(ticket, auth),
    };
  }

  /**
   * Provera pre komentara. Baca:
   *   TICKET_CLOSED              - zahtev je zatvoren
   *   FORBIDDEN_INTERNAL_COMMENT - korisnik pokušava internu belešku
   */
  assertCanComment(ticket: TicketAccessInfo, auth: AuthContext, isInternal: boolean): void {
    if (ticket.status === "closed") throw new AppError("TICKET_CLOSED");
    if (isInternal && !auth.isStaff()) throw new AppError("FORBIDDEN_INTERNAL_COMMENT");
  }

  /**
   * Provera pre dodele. Baca:
   *   TICKET_CLOSED           - zahtev je zatvoren
   *   FORBIDDEN               - agent dodeljuje nekom drugom ili oslobađa zahtev
   *   TICKET_ALREADY_ASSIGNED - agent preuzima zahtev koji je već tuđi
   */
  assertCanAssign(ticket: TicketAccessInfo, auth: AuthContext, assigneeId: string | null): void {
    if (ticket.status === "closed") throw new AppError("TICKET_CLOSED");
    if (auth.isAdmin()) return;
    if (auth.role !== "agent" || assigneeId !== auth.userId) throw new AppError("FORBIDDEN");
    if (ticket.assignedTo !== null && ticket.assignedTo !== auth.userId) {
      throw new AppError("TICKET_ALREADY_ASSIGNED");
    }
  }

  /**
   * Provera pre izmene. Ulaz: polja koja se menjaju. Baca:
   *   TICKET_CLOSED      - zahtev je zatvoren
   *   NOT_ASSIGNED_AGENT - agent menja zahtev koji nije njegov
   *   FORBIDDEN          - korisnik menja tuđ ili neotvoren zahtev, ili
   *                        kategoriju/prioritet (to određuje tim podrške)
   */
  assertCanEdit(
    ticket: TicketAccessInfo,
    auth: AuthContext,
    fields: readonly EditableTicketField[],
  ): void {
    if (ticket.status === "closed") throw new AppError("TICKET_CLOSED");
    if (auth.role === "agent" && ticket.assignedTo !== auth.userId) {
      throw new AppError("NOT_ASSIGNED_AGENT");
    }
    if (auth.role === "customer") {
      const onlyText = fields.every((field) => field === "title" || field === "description");
      if (!this.canEdit(ticket, auth) || !onlyText) throw new AppError("FORBIDDEN");
    }
  }

  /**
   * Provera pre ocene. Baca:
   *   FORBIDDEN           - ocenjuje neko ko nije vlasnik
   *   TICKET_NOT_RESOLVED - zahtev još nije rešen
   *   ALREADY_RATED       - ocena već postoji
   */
  assertCanRate(ticket: TicketAccessInfo, auth: AuthContext, hasRating: boolean): void {
    if (ticket.createdBy !== auth.userId) throw new AppError("FORBIDDEN");
    if (ticket.status !== "resolved" && ticket.status !== "closed") {
      throw new AppError("TICKET_NOT_RESOLVED");
    }
    if (hasRating) throw new AppError("ALREADY_RATED");
  }
}
