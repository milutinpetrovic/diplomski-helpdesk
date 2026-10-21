/**
 * Fajl: src/services/dashboard/dashboard-counts.ts
 * Svrha: od redova SQL funkcije ticket_counts() (status, prioritet, dodela,
 * broj) računa sve brojeve za kontrolni panel. Izdvojeno kao čista funkcija
 * (bez baze), da bi se lako testiralo (tests/unit/dashboard.test.ts).
 * Koristi ga: DashboardService.
 * Povezano sa: supabase/migrations/..._dashboard.sql (ticket_counts).
 */
import type { StatusCounts } from "@/lib/validation/dashboard";
import { UNRESOLVED_TICKET_STATUSES, type TicketPriority, type TicketStatus } from "@/types/domain";

/** Jedan red iz ticket_counts(): koliko zahteva ima ovu kombinaciju. */
export interface TicketCountRow {
  status: TicketStatus;
  priority: TicketPriority;
  /** 'me' = dodeljen prijavljenom, 'unassigned' = nikome, 'other' = nekom drugom. */
  assignment: string;
  total: number;
}

/** Brojevi izračunati iz redova. */
export interface DashboardCounts {
  /** Svi vidljivi zahtevi po statusu (korisnik: samo njegovi). */
  statusCounts: StatusCounts;
  /** Zahtevi dodeljeni prijavljenom, po statusu. */
  myStatusCounts: StatusCounts;
  /** Zahtevi koji nisu rešeni ni zatvoreni. */
  openCount: number;
  /** Nedodeljeni nerešeni zahtevi. */
  unassignedCount: number;
  /** Hitni nerešeni zahtevi (svi vidljivi). */
  urgentCount: number;
}

/** Statusi u kojima zahtev još nije rešen (iz src/types/domain.ts). */
export const UNRESOLVED_STATUSES = UNRESOLVED_TICKET_STATUSES;

/** Prazni brojevi po statusu (svi statusi sa nulom). */
function emptyStatusCounts(): StatusCounts {
  return { open: 0, in_progress: 0, waiting_on_customer: 0, resolved: 0, closed: 0 };
}

/**
 * Sabira redove u brojeve za panel.
 * Ulaz: redovi iz ticket_counts(). Vraća: DashboardCounts.
 */
export function summarizeCounts(rows: readonly TicketCountRow[]): DashboardCounts {
  const result: DashboardCounts = {
    statusCounts: emptyStatusCounts(),
    myStatusCounts: emptyStatusCounts(),
    openCount: 0,
    unassignedCount: 0,
    urgentCount: 0,
  };

  for (const row of rows) {
    // Korak 1: po statusu (svi i samo moji).
    result.statusCounts[row.status] += row.total;
    if (row.assignment === "me") result.myStatusCounts[row.status] += row.total;

    // Korak 2: nerešeni zahtevi — ukupno, nedodeljeni i hitni.
    const unresolved = (UNRESOLVED_STATUSES as readonly TicketStatus[]).includes(row.status);
    if (!unresolved) continue;
    result.openCount += row.total;
    if (row.assignment === "unassigned") result.unassignedCount += row.total;
    if (row.priority === "urgent") result.urgentCount += row.total;
  }
  return result;
}
