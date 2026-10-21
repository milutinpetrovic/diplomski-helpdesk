/**
 * Fajl: src/lib/realtime/supabase-provider.ts
 * Svrha: implementacija RealtimeProvider-a nad Supabase Realtime-om (WebSocket).
 *   - obaveštenja (NOTIFICATION_CREATED na kanalu user:<id>): `postgres_changes`
 *     nad tabelom notifications; Supabase poštuje RLS, pa stižu samo sopstvena
 *   - svi ostali događaji: privatni `broadcast` kanali (ticket:<id>, staff),
 *     uz dozvole iz migracije realtime_authorization
 * Jedan Supabase kanal po nazivu: Supabase za isti naziv vraća isti kanal i ne
 * dozvoljava dvostruku pretplatu, pa provajder vodi spisak slušalaca po kanalu
 * i zatvara kanal tek kad ode poslednji slušalac (npr. stranica zahteva i
 * zvonce slušaju u isto vreme).
 * Koristi ga: index.ts (getRealtimeProvider) u pregledaču, preko hook-ova u src/hooks/.
 * Povezano sa: types.ts, events.ts, docs/02, sekcija 7.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";

import { REALTIME_EVENTS, type RealtimeEvent } from "@/lib/realtime/events";
import type { RealtimePayload, RealtimeProvider, Unsubscribe } from "@/lib/realtime/types";
import type { DbClient } from "@/lib/supabase/types";

/** Jedan slušalac: koji događaj čeka i koju funkciju poziva. */
interface Listener {
  event: RealtimeEvent;
  handler: (payload: RealtimePayload) => void;
}

/** Otvoren Supabase kanal i njegovi slušaoci. */
interface TopicEntry {
  /** Kanal; null dok se ne pripremi prijava (setAuth) i ne otvori. */
  channel: RealtimeChannel | null;
  listeners: Set<Listener>;
  /** true kad je otišao poslednji slušalac pre nego što se kanal otvorio. */
  closed: boolean;
}

/** Supabase Realtime implementacija slušanja događaja. */
export class SupabaseRealtimeProvider implements RealtimeProvider {
  /** Otvoreni kanali po nazivu (ticket:<id>, staff, user:<id>:notifications). */
  private readonly topics = new Map<string, TopicEntry>();

  /** Ulaz: Supabase klijent iz pregledača (sa sesijom prijavljenog korisnika). */
  constructor(private readonly client: DbClient) {}

  /**
   * Počinje slušanje događaja na kanalu.
   * Ulaz: naziv kanala, vrsta događaja i funkcija koja se poziva za svaku poruku.
   * Vraća: funkciju koja prekida slušanje (kanal se zatvara kad nema više slušalaca).
   */
  subscribe(
    channel: string,
    event: RealtimeEvent,
    handler: (payload: RealtimePayload) => void,
  ): Unsubscribe {
    // Korak 1: obaveštenja idu preko tabele, ostalo preko broadcast kanala.
    const isNotification = event === REALTIME_EVENTS.NOTIFICATION_CREATED;
    const topic = isNotification ? `${channel}:notifications` : channel;

    // Korak 2: postojeći kanal ili novi (otvara se posle pripreme prijave).
    let entry = this.topics.get(topic);
    if (!entry) {
      const created: TopicEntry = { channel: null, listeners: new Set(), closed: false };
      entry = created;
      this.topics.set(topic, created);
      void this.open(topic, channel, isNotification, created);
    }

    // Korak 3: upis slušaoca.
    const listener: Listener = { event, handler };
    entry.listeners.add(listener);

    // Korak 4: funkcija za prekid slušanja.
    const current = entry;
    return () => {
      current.listeners.delete(listener);
      if (current.listeners.size > 0) return;
      current.closed = true;
      this.topics.delete(topic);
      if (current.channel) void this.client.removeChannel(current.channel);
    };
  }

  /**
   * Otvara Supabase kanal. Pre toga Realtime dobija pristupni token
   * prijavljenog korisnika, jer privatni kanali i RLS nad notifications
   * proveravaju ko sluša (bez tokena bi korisnik bio gost i bio odbijen).
   */
  private async open(
    topic: string,
    channel: string,
    isNotification: boolean,
    entry: TopicEntry,
  ): Promise<void> {
    // Korak 1: token iz sesije (kolačić) za Realtime vezu.
    const { data } = await this.client.auth.getSession();
    await this.client.realtime.setAuth(data.session?.access_token ?? null);
    if (entry.closed) return;

    // Korak 2: poruka se prosleđuje svim slušaocima tog događaja.
    const dispatch = (payload: RealtimePayload) => {
      for (const listener of entry.listeners) {
        if (listener.event === payload.event) listener.handler(payload);
      }
    };

    // Korak 3: kanal po vrsti (tabela obaveštenja ili broadcast).
    entry.channel = isNotification
      ? this.notificationsChannel(topic, channel, dispatch)
      : this.broadcastChannel(topic, dispatch);
  }

  /** Broadcast poruke na privatnom kanalu (ticket:<id>, staff); jedan kanal za sve događaje. */
  private broadcastChannel(
    topic: string,
    dispatch: (payload: RealtimePayload) => void,
  ): RealtimeChannel {
    return this.client
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "*" }, (message) => dispatch(message.payload as RealtimePayload))
      .subscribe();
  }

  /**
   * Nova obaveštenja: INSERT u tabelu notifications za korisnika iz naziva
   * kanala user:<id>. Payload sadrži samo ID zahteva i aktera (tekst
   * obaveštenja UI sastavlja posle učitavanja kroz API).
   */
  private notificationsChannel(
    topic: string,
    channel: string,
    dispatch: (payload: RealtimePayload) => void,
  ): RealtimeChannel {
    const userId = channel.replace(/^user:/, "");
    return this.client
      .channel(topic)
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
          dispatch({
            event: REALTIME_EVENTS.NOTIFICATION_CREATED,
            ticketId: row.ticket_id ?? undefined,
            actorId: row.actor_id ?? undefined,
          });
        },
      )
      .subscribe();
  }
}
