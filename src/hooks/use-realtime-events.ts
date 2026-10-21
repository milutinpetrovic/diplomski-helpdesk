/**
 * Fajl: src/hooks/use-realtime-events.ts
 * Svrha: hook useRealtimeEvents — zajednički deo svih real-time hook-ova:
 * pretplata na jedan ili više kanala preko RealtimeProvider interfejsa (nikad
 * direktno na Supabase) i odjava kad komponenta nestane sa ekrana.
 * Koriste ga: useTicketRealtime, useStaffRealtime, useNotifications.
 * Povezano sa: src/lib/realtime (getRealtimeProvider, nazivi kanala i događaja),
 * CLAUDE.md „Real-time sloj“ (zamena provajdera ne menja ovaj hook).
 */
"use client";

import { useEffect, useEffectEvent } from "react";

import { getRealtimeProvider } from "@/lib/realtime";
import type { RealtimeEvent } from "@/lib/realtime/events";
import type { RealtimePayload } from "@/lib/realtime/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/** Jedan kanal i događaji koje na njemu slušamo. */
export interface RealtimeSubscription {
  channel: string;
  events: readonly RealtimeEvent[];
}

/**
 * Sluša događaje na datim kanalima dok je komponenta na ekranu.
 * Ulaz: spisak kanala i događaja (prazan spisak = ne sluša ništa) i funkcija
 * koja se poziva za svaki događaj (uvek najnovija verzija, bez ponovne pretplate).
 * Uloge: svi prijavljeni; ko sme na koji kanal odlučuje baza (Realtime Authorization).
 */
export function useRealtimeEvents(
  subscriptions: readonly RealtimeSubscription[],
  onEvent: (payload: RealtimePayload) => void,
): void {
  // Korak 1: funkcija za događaj ne utiče na pretplatu (useEffectEvent).
  const handleEvent = useEffectEvent(onEvent);

  // Korak 2: pretplata se menja samo kad se promene kanali ili događaji.
  const key = subscriptions
    .map((subscription) => `${subscription.channel}|${subscription.events.join(",")}`)
    .join(";");

  useEffect(() => {
    if (!key) return;

    // Korak 3: pretplata na svaki par kanal + događaj.
    const provider = getRealtimeProvider(createBrowserSupabaseClient());
    const unsubscribes = key.split(";").flatMap((part) => {
      const [channel, events] = part.split("|");
      return (events ?? "")
        .split(",")
        .map((event) =>
          provider.subscribe(channel ?? "", event as RealtimeEvent, (payload) =>
            handleEvent(payload),
          ),
        );
    });

    // Korak 4: odjava pri napuštanju stranice ili promeni kanala.
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [key]);
}
