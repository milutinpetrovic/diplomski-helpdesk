/**
 * Fajl: src/services/shared/publish.ts
 * Svrha: slanje real-time događaja posle uspešne izmene zahteva, na jednom
 * mestu za sve servise. Događaj nosi samo ID zahteva i ID aktera (nikad
 * tekst), a otvorene stranice posle njega ponovo učitavaju podatke kroz API.
 * Kanali:
 *   - ticket:<id> — vlasnik zahteva i tim podrške (stranica zahteva)
 *   - staff       — samo tim; šalje se samo kad je akter agent ili admin,
 *                   jer korisnik nema pravo slanja na taj kanal (politika u bazi)
 * Interna beleška ide SAMO na kanal staff, da korisnik ne sazna ni da je dodata.
 * Klijentsko slušanje (osvežavanje bez reload-a) dolazi u Fazi 7.
 * Koriste ga: TicketService, CommentService, RatingService.
 * Povezano sa: src/lib/realtime (RealtimePublisher), CLAUDE.md „Real-time sloj“.
 */
import { STAFF_CHANNEL, ticketChannel, type RealtimeEvent } from "@/lib/realtime/events";
import type { ServiceContext } from "@/services/service-context";

/** Kome se događaj šalje. */
export type PublishAudience = "ticket-and-staff" | "staff-only";

/**
 * Šalje događaj o zahtevu. Greška pri slanju se samo beleži u log: izmena je
 * već upisana u bazu, pa API poziv ne sme da padne zbog real-time-a.
 * Ulaz: kontekst servisa, vrsta događaja, ID zahteva i kome se šalje.
 */
export async function publishTicketEvent(
  ctx: ServiceContext,
  event: RealtimeEvent,
  ticketId: string,
  audience: PublishAudience = "ticket-and-staff",
): Promise<void> {
  // Korak 1: spisak kanala po pravilima iz zaglavlja fajla.
  const channels: string[] = [];
  if (audience === "ticket-and-staff") channels.push(ticketChannel(ticketId));
  if (ctx.auth.isStaff()) channels.push(STAFF_CHANNEL);

  // Korak 2: slanje; neuspeh ne prekida API poziv.
  const payload = { ticketId, actorId: ctx.auth.userId };
  for (const channel of channels) {
    try {
      await ctx.publisher.publish(channel, event, payload);
    } catch (error) {
      console.warn(`[realtime] događaj ${event} na ${channel} nije poslat`, error);
    }
  }
}
