/**
 * Fajl: src/components/notifications/LiveRefresh.tsx
 * Svrha: nevidljive komponente koje uključuju osvežavanje bez reload-a (FZ-13):
 *   - StaffLiveRefresh: za agenta i admina sluša kanal staff (lista zahteva i panel)
 *   - TicketLiveRefresh: na stranici zahteva sluša kanal ticket:<id>
 * Ništa ne prikazuju; postoje da bi serverske stranice mogle da uključe
 * real-time hook-ove (hook-ovi rade samo u klijentskim komponentama).
 * Koriste ih: AppShell (StaffLiveRefresh) i stranica /tickets/[id] (TicketLiveRefresh).
 * Povezano sa: useStaffRealtime, useTicketRealtime.
 */
"use client";

import { useStaffRealtime } from "@/hooks/use-staff-realtime";
import { useTicketRealtime } from "@/hooks/use-ticket-realtime";

/**
 * Osvežavanje stranica sa zahtevima za tim podrške.
 * Ulaz: da li je korisnik agent ili admin i njegov ID. Uloge: agent, admin.
 */
export function StaffLiveRefresh({ isStaff, userId }: { isStaff: boolean; userId: string }) {
  useStaffRealtime(isStaff, userId);
  return null;
}

/**
 * Osvežavanje stranice jednog zahteva.
 * Ulaz: ID zahteva i ID prijavljenog korisnika. Uloge: vlasnik zahteva, agent, admin.
 */
export function TicketLiveRefresh({ ticketId, userId }: { ticketId: string; userId: string }) {
  useTicketRealtime(ticketId, userId);
  return null;
}
