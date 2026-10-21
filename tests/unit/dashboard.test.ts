/**
 * Unit testovi: kontrolni panel (Faza 6):
 *   - summarizeCounts (src/services/dashboard/dashboard-counts.ts): od redova
 *     SQL funkcije ticket_counts() do brojeva na panelu
 *   - Zod šema odgovora GET /api/dashboard (polje kind)
 *   - prevodi panela u oba jezika
 */
import { describe, expect, it } from "vitest";

import { dashboardDataSchema } from "@/lib/validation/dashboard";
import { summarizeCounts, type TicketCountRow } from "@/services/dashboard/dashboard-counts";
import en from "../../messages/en.json";
import sr from "../../messages/sr.json";

/** Redovi kao iz ticket_counts(): status, prioritet, dodela, broj. */
const ROWS: TicketCountRow[] = [
  { status: "open", priority: "urgent", assignment: "unassigned", total: 2 },
  { status: "open", priority: "low", assignment: "unassigned", total: 1 },
  { status: "in_progress", priority: "urgent", assignment: "me", total: 1 },
  { status: "in_progress", priority: "urgent", assignment: "other", total: 3 },
  { status: "waiting_on_customer", priority: "medium", assignment: "me", total: 2 },
  { status: "resolved", priority: "urgent", assignment: "me", total: 4 },
  { status: "closed", priority: "high", assignment: "other", total: 5 },
];

describe("summarizeCounts", () => {
  const counts = summarizeCounts(ROWS);

  it("broji sve zahteve po statusu i posebno one dodeljene meni", () => {
    expect(counts.statusCounts).toEqual({
      open: 3,
      in_progress: 4,
      waiting_on_customer: 2,
      resolved: 4,
      closed: 5,
    });
    expect(counts.myStatusCounts).toEqual({
      open: 0,
      in_progress: 1,
      waiting_on_customer: 2,
      resolved: 4,
      closed: 0,
    });
  });

  it("otvoreni, nedodeljeni i hitni broje samo nerešene zahteve", () => {
    expect(counts.openCount).toBe(9);
    expect(counts.unassignedCount).toBe(3);
    // Hitni: 2 nedodeljena + 1 moj + 3 tuđa; rešeni hitni (4) se ne broje.
    expect(counts.urgentCount).toBe(6);
  });

  it("bez redova: sve nule (i svi statusi prisutni)", () => {
    const empty = summarizeCounts([]);
    expect(empty.statusCounts).toEqual({
      open: 0,
      in_progress: 0,
      waiting_on_customer: 0,
      resolved: 0,
      closed: 0,
    });
    expect(empty.openCount + empty.unassignedCount + empty.urgentCount).toBe(0);
  });
});

describe("dashboardDataSchema", () => {
  const zeroCounts = { open: 0, in_progress: 0, waiting_on_customer: 0, resolved: 0, closed: 0 };

  it("prihvata panel korisnika i bira oblik po polju kind", () => {
    const data = {
      kind: "customer",
      statusCounts: zeroCounts,
      waitingOnMe: [],
      toRate: [],
      recent: [],
    };
    expect(dashboardDataSchema.parse(data)).toEqual(data);
  });

  it("odbija nepoznat kind i panel kome nedostaju polja", () => {
    expect(dashboardDataSchema.safeParse({ kind: "guest" }).success).toBe(false);
    expect(
      dashboardDataSchema.safeParse({ kind: "agent", myStatusCounts: zeroCounts }).success,
    ).toBe(false);
  });

  it("prosečna ocena agenta može biti null (još nema ocena)", () => {
    const result = dashboardDataSchema.safeParse({
      kind: "agent",
      myStatusCounts: zeroCounts,
      unassignedCount: 0,
      urgentCount: 0,
      unassignedQueue: [],
      urgent: [],
      rating: { average: null, count: 0 },
      resolvedCount: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("prevodi panela", () => {
  it("srpski i engleski imaju iste ključeve u sekciji dashboard", () => {
    expect(Object.keys(sr.dashboard).sort()).toEqual(Object.keys(en.dashboard).sort());
  });
});
