/**
 * Fajl: src/services/ratings/rating-service.ts
 * Svrha: RatingService — ocena zadovoljstva (CSAT, FZ-16, UC-14): vlasnik
 * zahteva ocenjuje rešen zahtev sa 1–5 zvezdica i opcionim komentarom,
 * najviše jednom. Ocena ulazi u analitiku (Faza 8).
 * Koriste ga: ruta src/app/api/tickets/[id]/rating/route.ts.
 * Povezano sa: TicketAccessPolicy (assertCanRate), RPC rate_ticket (iste
 * provere u bazi, istorija `rated` i obaveštenje agentu), docs/03 (RatingService).
 */
import { fromDbError } from "@/lib/errors/app-error";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import type { RateTicketInput, TicketRating } from "@/lib/validation/ratings";
import { TicketAccessPolicy } from "@/services/policies/ticket-access";
import type { ServiceContext } from "@/services/service-context";
import { publishTicketEvent } from "@/services/shared/publish";
import { loadVisibleTicket, toRating } from "@/services/tickets/ticket-service";
import type { Database } from "@/types/database";

/** Red tabele ticket_ratings. */
type RatingRow = Database["public"]["Tables"]["ticket_ratings"]["Row"];

/** Servis za ocene. Uloge: samo korisnik (vlasnik zahteva). */
export class RatingService {
  /** Ulaz: ServiceContext i politika pristupa (zamenljiva u testovima). */
  constructor(
    private readonly ctx: ServiceContext,
    private readonly access = new TicketAccessPolicy(),
  ) {}

  /**
   * Ocenjuje zahtev (POST /api/tickets/{id}/rating).
   * Ulaz: ID zahteva, ocena 1–5 i opcioni komentar.
   * Vraća: sačuvanu ocenu.
   * Baca: TICKET_NOT_FOUND, FORBIDDEN (nije vlasnik), TICKET_NOT_RESOLVED,
   * ALREADY_RATED.
   */
  async rate(ticketId: string, input: RateTicketInput): Promise<TicketRating> {
    // Korak 1: zahtev i da li ocena već postoji.
    const ticket = await loadVisibleTicket(this.ctx, ticketId);
    const { count, error: countError } = await this.ctx.db
      .from("ticket_ratings")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticketId);
    if (countError) throw fromDbError(countError);

    // Korak 2: pravila (vlasnik, rešen zahtev, samo jednom).
    this.access.assertCanRate(ticket, this.ctx.auth, (count ?? 0) > 0);

    // Korak 3: upis kroz RPC (ocena + istorija + obaveštenje agentu).
    const { data, error } = await this.ctx.db
      .rpc("rate_ticket", {
        p_ticket_id: ticketId,
        p_score: input.score,
        ...(input.comment ? { p_comment: input.comment } : {}),
      })
      .single<RatingRow>();
    if (error) throw fromDbError(error);

    // Korak 4: real-time događaj (stranica zahteva prikazuje ocenu) i odgovor.
    await publishTicketEvent(this.ctx, REALTIME_EVENTS.TICKET_UPDATED, ticketId);
    return toRating(data);
  }
}
