/**
 * Fajl: src/hooks/use-staff-realtime.ts
 * Svrha: hook useStaffRealtime — lista zahteva i kontrolni panel tima podrške
 * se osvežavaju bez reload-a kad agent ili admin izmeni bilo koji zahtev.
 * Sluša privatni kanal staff (samo agent i admin, Realtime Authorization).
 * Novi zahtevi i akcije korisnika ne idu na kanal staff (korisnik nema pravo
 * slanja na njega); za njih tim dobija obaveštenje, koje takođe osvežava
 * stranicu (useNotifications).
 * Koristi ga: LiveRefresh u zaglavlju (samo za agenta i admina).
 * Povezano sa: publishTicketEvent (server šalje na staff), useRealtimeEvents.
 */
"use client";

import { usePathname } from "next/navigation";

import { useDebouncedRefresh } from "@/hooks/use-debounced-refresh";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { TICKET_REFRESH_EVENTS } from "@/hooks/use-ticket-realtime";
import { STAFF_CHANNEL } from "@/lib/realtime/events";

/**
 * Da li stranica prikazuje zahteve i treba je osvežiti na događaj:
 * kontrolni panel, lista zahteva ili stranica jednog zahteva.
 */
export function isLiveRefreshPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname === "/tickets" || pathname.startsWith("/tickets/");
}

/**
 * Osvežava stranice sa zahtevima na događaje sa kanala staff.
 * Ulaz: da li je korisnik član tima (korisnik ne sluša ništa) i njegov ID
 * (sopstvene akcije se ne osvežavaju ponovo). Uloge: agent, admin.
 */
export function useStaffRealtime(isStaff: boolean, currentUserId: string): void {
  const pathname = usePathname();
  const refresh = useDebouncedRefresh();
  useRealtimeEvents(
    isStaff ? [{ channel: STAFF_CHANNEL, events: TICKET_REFRESH_EVENTS }] : [],
    (payload) => {
      if (payload.actorId !== currentUserId && isLiveRefreshPath(pathname)) refresh();
    },
  );
}
