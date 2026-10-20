/**
 * Fajl: src/lib/realtime/types.ts
 * Svrha: interfejsi real-time sloja. Komponente i servisi zavise SAMO od ovih
 * interfejsa, nikad direktno od Supabase Realtime-a, pa se provajder može
 * zameniti (npr. sopstvenim WebSocket serverom) bez izmene komponenti.
 * Koriste ga: supabase-provider.ts, supabase-publisher.ts, index.ts, servisi i hook-ovi.
 * Povezano sa: CLAUDE.md, sekcija „Real-time sloj“, docs/03, sekcija 4.
 */
import type { RealtimeEvent } from "@/lib/realtime/events";

/**
 * Sadržaj real-time poruke. Namerno nosi SAMO ID-jeve, nikad tekst: klijent
 * posle poruke ponovo učitava podatke kroz API, gde važe prava pristupa.
 */
export interface RealtimePayload {
  /** Na koji zahtev se događaj odnosi (ako se odnosi na zahtev). */
  ticketId?: string;
  /** Vrsta događaja. */
  event: RealtimeEvent;
  /** Ko je izazvao događaj (da klijent može da ignoriše sopstvene akcije). */
  actorId?: string;
}

/** Funkcija koja prekida slušanje kanala. */
export type Unsubscribe = () => void;

/**
 * Slušanje događaja (koristi se u pregledaču).
 * subscribe vraća funkciju za prekid slušanja (poziva se pri napuštanju stranice).
 */
export interface RealtimeProvider {
  subscribe(
    channel: string,
    event: RealtimeEvent,
    handler: (payload: RealtimePayload) => void,
  ): Unsubscribe;
}

/**
 * Slanje događaja (koristi se SAMO na serveru, u servisima, posle uspešnog
 * upisa u bazu). Klijent nikad ne šalje događaje.
 * Ulaz: kanal, vrsta događaja i ID-jevi (ticketId, actorId); polje `event`
 * u poruci popunjava sam publisher.
 */
export interface RealtimePublisher {
  publish(
    channel: string,
    event: RealtimeEvent,
    payload: Omit<RealtimePayload, "event">,
  ): Promise<void>;
}
