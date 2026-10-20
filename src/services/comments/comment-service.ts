/**
 * Fajl: src/services/comments/comment-service.ts
 * Svrha: CommentService — komentari na zahtevu (FZ-8):
 *   - lista komentara (korisnik vidi samo javne, tim vidi i interne beleške)
 *   - novi javni komentar ili interna beleška (UC-12, UC-18)
 * Interne beleške korisniku sakriva RLS politika u bazi, pa ih ni API ni
 * interfejs ne mogu greškom poslati korisniku.
 * Baza (RPC add_comment) uz komentar sama: upisuje vreme prvog odgovora
 * tima (first_response_at), vraća zahtev iz „Čeka korisnika“ u „U obradi“
 * kad vlasnik odgovori, i pravi obaveštenja.
 * Koriste ga: ruta src/app/api/tickets/[id]/comments/route.ts.
 * Povezano sa: TicketAccessPolicy, docs/03 (klasa CommentService), docs/06.
 */
import { fromDbError } from "@/lib/errors/app-error";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import type { AddCommentInput, CommentWithAuthor } from "@/lib/validation/comments";
import { TicketAccessPolicy } from "@/services/policies/ticket-access";
import type { ServiceContext } from "@/services/service-context";
import { loadProfileSummaries, pick } from "@/services/shared/lookups";
import { publishTicketEvent } from "@/services/shared/publish";
import { loadVisibleTicket } from "@/services/tickets/ticket-service";
import type { Database } from "@/types/database";

/** Red tabele ticket_comments. */
type CommentRow = Database["public"]["Tables"]["ticket_comments"]["Row"];

/** Kolone komentara koje API vraća. */
const COMMENT_COLUMNS = "id, ticket_id, author_id, body, is_internal, created_at";

/** Servis za komentare. Uloge: vlasnik zahteva, agent, admin. */
export class CommentService {
  /** Ulaz: ServiceContext i politika pristupa (zamenljiva u testovima). */
  constructor(
    private readonly ctx: ServiceContext,
    private readonly access = new TicketAccessPolicy(),
  ) {}

  /**
   * Komentari na zahtevu, od najstarijeg (GET /api/tickets/{id}/comments).
   * Vraća: komentare sa imenom autora. Korisnik ne dobija interne beleške (RLS).
   * Baca: TICKET_NOT_FOUND (ne postoji ili je tuđ).
   */
  async list(ticketId: string): Promise<CommentWithAuthor[]> {
    // Korak 1: pristup zahtevu.
    await loadVisibleTicket(this.ctx, ticketId);

    // Korak 2: komentari koje RLS dozvoljava prijavljenom korisniku.
    const { data, error } = await this.ctx.db
      .from("ticket_comments")
      .select(COMMENT_COLUMNS)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error) throw fromDbError(error);

    // Korak 3: imena autora i oblik za API.
    const authors = await loadProfileSummaries(
      this.ctx.db,
      data.map((row) => row.author_id),
    );
    return data.map((row) => ({
      id: row.id,
      ticketId: row.ticket_id,
      body: row.body,
      isInternal: row.is_internal,
      createdAt: row.created_at,
      author: pick(authors, row.author_id),
    }));
  }

  /**
   * Novi komentar (POST /api/tickets/{id}/comments).
   * Ulaz: ID zahteva, tekst i da li je interna beleška.
   * Vraća: novi komentar sa autorom.
   * Baca: TICKET_NOT_FOUND, TICKET_CLOSED, FORBIDDEN_INTERNAL_COMMENT.
   */
  async add(ticketId: string, input: AddCommentInput): Promise<CommentWithAuthor> {
    // Korak 1: pristup i pravila (zatvoren zahtev, interna beleška samo za tim).
    const ticket = await loadVisibleTicket(this.ctx, ticketId);
    this.access.assertCanComment(ticket, this.ctx.auth, input.isInternal);

    // Korak 2: upis kroz RPC (komentar + first_response_at + automatski
    // prelaz statusa + obaveštenja, sve u jednoj transakciji).
    const { data, error } = await this.ctx.db
      .rpc("add_comment", {
        p_ticket_id: ticketId,
        p_body: input.body,
        p_is_internal: input.isInternal,
      })
      .single<CommentRow>();
    if (error) throw fromDbError(error);

    // Korak 3: real-time događaj. Interna beleška ide samo timu podrške.
    await publishTicketEvent(
      this.ctx,
      REALTIME_EVENTS.TICKET_COMMENT_ADDED,
      ticketId,
      input.isInternal ? "staff-only" : "ticket-and-staff",
    );

    // Korak 4: odgovor sa imenom autora (prijavljeni korisnik).
    const authors = await loadProfileSummaries(this.ctx.db, [data.author_id]);
    return {
      id: data.id,
      ticketId: data.ticket_id,
      body: data.body,
      isInternal: data.is_internal,
      createdAt: data.created_at,
      author: pick(authors, data.author_id),
    };
  }
}
