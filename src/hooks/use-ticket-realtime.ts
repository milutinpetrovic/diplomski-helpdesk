/**
 * Fajl: src/hooks/use-ticket-realtime.ts
 * Svrha: hook useTicketRealtime — stranica zahteva se osvežava bez reload-a
 * kad neko drugi doda komentar, promeni status ili dodeli zahtev (FZ-13, SD-05).
 * Sluša privatni kanal ticket:<id>; na njega smeju samo vlasnik zahteva i tim
 * podrške (Realtime Authorization u bazi). Događaj nosi samo ID-jeve, a sveži
 * podaci stižu ponovnim učitavanjem stranice (kroz servis, RBAC i RLS).
 * Koristi ga: TicketLiveRefresh na stranici /tickets/[id].
 * Povezano sa: publishTicketEvent (server šalje događaje), useRealtimeEvents.
 */
"use client";

import { useDebouncedRefresh } from "@/hooks/use-debounced-refresh";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { REALTIME_EVENTS, ticketChannel } from "@/lib/realtime/events";

/** Događaji na kanalu zahteva posle kojih se stranica osvežava. */
export const TICKET_REFRESH_EVENTS = [
  REALTIME_EVENTS.TICKET_UPDATED,
  REALTIME_EVENTS.TICKET_COMMENT_ADDED,
  REALTIME_EVENTS.TICKET_ASSIGNED,
] as const;

/**
 * Osvežava stranicu zahteva na događaje sa kanala ticket:<id>.
 * Ulaz: ID zahteva i ID prijavljenog korisnika (sopstvene akcije se ne
 * osvežavaju ponovo, to već radi useApiAction). Uloge: vlasnik zahteva, agent, admin.
 */
export function useTicketRealtime(ticketId: string, currentUserId: string): void {
  const refresh = useDebouncedRefresh();
  useRealtimeEvents(
    [{ channel: ticketChannel(ticketId), events: TICKET_REFRESH_EVENTS }],
    (payload) => {
      if (payload.actorId !== currentUserId) refresh();
    },
  );
}
