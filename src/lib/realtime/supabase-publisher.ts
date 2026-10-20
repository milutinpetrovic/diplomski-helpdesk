/**
 * Fajl: src/lib/realtime/supabase-publisher.ts
 * Svrha: implementacija RealtimePublisher-a nad Supabase Realtime-om. Šalje
 * broadcast poruku na privatni kanal preko HTTP-a (bez otvaranja WebSocket
 * veze, što odgovara serverless okruženju na Vercel-u i Netlify-u).
 * Koristi ga: servisi na serveru (preko ServiceContext.publisher), posle
 * uspešnog upisa u bazu.
 * Povezano sa: types.ts, politika realtime_broadcast_insert u bazi (pošiljalac
 * mora smeti da vidi kanal).
 */
import type { RealtimeEvent } from "@/lib/realtime/events";
import type { RealtimePayload, RealtimePublisher } from "@/lib/realtime/types";
import type { DbClient } from "@/lib/supabase/types";

/** Supabase Realtime implementacija slanja događaja. */
export class SupabaseRealtimePublisher implements RealtimePublisher {
  /** Ulaz: Supabase klijent sa sesijom korisnika koji je izvršio izmenu. */
  constructor(private readonly client: DbClient) {}

  /**
   * Šalje događaj na kanal. Neuspeh slanja se samo beleži u log i ne ruši
   * API poziv: izmena je već upisana u bazu, a klijent će podatke videti
   * najkasnije pri sledećem učitavanju.
   */
  async publish(
    channel: string,
    event: RealtimeEvent,
    payload: Omit<RealtimePayload, "event">,
  ): Promise<void> {
    const realtimeChannel = this.client.channel(channel, { config: { private: true } });
    try {
      const message: RealtimePayload = { ...payload, event };
      const result = await realtimeChannel.httpSend(event, message);
      if (!result.success) {
        console.warn(`[realtime] slanje na ${channel} nije uspelo: ${result.error}`);
      }
    } finally {
      await this.client.removeChannel(realtimeChannel);
    }
  }
}
