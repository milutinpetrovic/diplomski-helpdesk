/**
 * Fajl: src/services/service-context.ts
 * Svrha: ServiceContext — sve što servis treba da bi radio: Supabase klijent
 * u ime prijavljenog korisnika, ko je korisnik (AuthContext) i real-time
 * publisher za slanje događaja posle upisa.
 * Pravi ga: withApi (src/lib/api/with-api.ts) za svaki API poziv.
 * Koriste ga: svi servisi (src/services/<domen>/<domen>-service.ts), npr.
 * new TicketService(ctx).
 * Povezano sa: docs/03-dijagram-klasa.md, sekcija 3.
 */
import type { AuthContext } from "@/lib/auth/auth-context";
import type { RealtimePublisher } from "@/lib/realtime/types";
import type { DbClient } from "@/lib/supabase/types";

/**
 * Kontekst za rute koje traže prijavu. Javne rute (prijava, registracija,
 * OpenAPI) nemaju ServiceContext; one same prave Supabase klijent kad im treba.
 */
export interface ServiceContext {
  /** Supabase klijent sa sesijom korisnika (važe RLS politike). */
  db: DbClient;
  /** Prijavljeni korisnik i njegova uloga. */
  auth: AuthContext;
  /** Slanje real-time događaja posle uspešne izmene. */
  publisher: RealtimePublisher;
}
