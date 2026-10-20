/**
 * Fajl: src/lib/realtime/supabase-provider.ts
 * Svrha: implementacija RealtimeProvider-a nad Supabase Realtime-om (WebSocket).
 *   - obaveštenja (NOTIFICATION_CREATED na kanalu user:<id>): `postgres_changes`
 *     nad tabelom notifications; Supabase poštuje RLS, pa stižu samo sopstvena
 *   - svi ostali događaji: privatni `broadcast` kanali (ticket:<id>, staff),
 *     uz dozvole iz migracije realtime_authorization
 * Koristi ga: index.ts (getRealtimeProvider) u pregledaču.
 * Povezano sa: types.ts, events.ts, docs/02, sekcija 7.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";

import { REALTIME_EVENTS, type RealtimeEvent } from "@/lib/realtime/events";
import type { RealtimePayload, RealtimeProvider, Unsubscribe } from "@/lib/realtime/types";
import type { DbClient } from "@/lib/supabase/types";

/** Supabase Realtime implementacija slušanja događaja. */
export class SupabaseRealtimeProvider implements RealtimeProvider {
  /** Ulaz: Supabase klijent iz pregledača (sa sesijom prijavljenog korisnika). */
  constructor(private readonly client: DbClient) {}

  /**
   * Počinje slušanje događaja na kanalu.
   * Ulaz: naziv kanala, vrsta događaja i funkcija koja se poziva za svaku poruku.
   * Vraća: funkciju koja prekida slušanje i zatvara kanal.
   */
  subscribe(
    channel: string,
    event: RealtimeEvent,
    handler: (payload: RealtimePayload) => void,
  ): Unsubscribe {
    // Korak 1: izbor načina slušanja po vrsti događaja.
    const subscription =
      event === REALTIME_EVENTS.NOTIFICATION_CREATED
        ? this.subscribeToNotifications(channel, handler)
        : this.subscribeToBroadcast(channel, event, handler);

    // Korak 2: funkcija za prekid slušanja.
    return () => {
      void this.client.removeChannel(subscription);
    };
  }

  /** Broadcast poruke na privatnom kanalu (ticket:<id>, staff). */
  private subscribeToBroadcast(
    channel: string,
    event: RealtimeEvent,
    handler: (payload: RealtimePayload) => void,
  ): RealtimeChannel {
    return this.client
      .channel(channel, { config: { private: true } })
      .on("broadcast", { event }, (message) => handler(message.payload as RealtimePayload))
      .subscribe();
  }

  /**
   * Nova obaveštenja: INSERT u tabelu notifications za korisnika iz naziva
   * kanala user:<id>. Payload sadrži samo ID zahteva (tekst obaveštenja UI
   * sastavlja posle učitavanja kroz API).
   */
  private subscribeToNotifications(
    channel: string,
    handler: (payload: RealtimePayload) => void,
  ): RealtimeChannel {
    const userId = channel.replace(/^user:/, "");
    return this.client
      .channel(`${channel}:notifications`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (change) => {
          const row = change.new as { ticket_id: string | null; actor_id: string | null };
          handler({
            event: REALTIME_EVENTS.NOTIFICATION_CREATED,
            ticketId: row.ticket_id ?? undefined,
            actorId: row.actor_id ?? undefined,
          });
        },
      )
      .subscribe();
  }
}
