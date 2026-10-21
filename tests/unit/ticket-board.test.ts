/**
 * Unit testovi: kanban tabla zahteva (/tickets?view=board), bez baze i bez React-a.
 *   - boardDropTargets: u koje kolone korisnik, agent (svoj, tuđ i nedodeljen
 *     zahtev) i admin smeju da prevuku karticu, i kada je to preuzimanje
 *   - needsDropConfirmation: otkazivanje traži potvrdu
 *   - applyBoardMoves: privremeno premeštanje kartice i brojevi kolona
 *   - parseTicketView / ticketListHref: prikaz u adresi (?view=board)
 */
import { describe, expect, it } from "vitest";

import {
  applyBoardMoves,
  boardDropTargets,
  needsDropConfirmation,
  type BoardColumnData,
  type BoardUser,
} from "@/components/tickets/board-rules";
import {
  parseTicketListParams,
  parseTicketView,
  ticketListHref,
} from "@/components/tickets/list-params";
import type { TicketListItem } from "@/lib/validation/tickets";
import type { TicketStatus, UserRole } from "@/types/domain";

const CUSTOMER: BoardUser = { id: "c-1", role: "customer" };
const AGENT: BoardUser = { id: "a-1", role: "agent" };
const ADMIN: BoardUser = { id: "ad-1", role: "admin" };

/** Osoba u listi (podnosilac ili dodeljeni). */
function person(id: string, role: UserRole) {
  return { id, fullName: id, avatarUrl: null, role };
}

/** Zahtev iz liste sa datim statusom, podnosiocem i (opciono) dodeljenim agentom. */
function ticket(
  id: string,
  status: TicketStatus,
  assigneeId: string | null = null,
  creatorId = CUSTOMER.id,
): TicketListItem {
  return {
    id,
    number: 1000 + Number(id.replace(/\D/g, "") || 0),
    title: `Zahtev ${id}`,
    status,
    priority: "medium",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    category: null,
    creator: person(creatorId, "customer"),
    assignee: assigneeId ? person(assigneeId, "agent") : null,
  };
}

/** Ciljne kolone kao sortiran niz (lakše poređenje). */
function targets(item: TicketListItem, user: BoardUser) {
  return [...boardDropTargets(item, user).entries()].sort(([a], [b]) => a.localeCompare(b));
}

describe("boardDropTargets — korisnik", () => {
  it("svoj otvoren zahtev sme samo da otkaže (zatvoren)", () => {
    expect(targets(ticket("t1", "open"), CUSTOMER)).toEqual([["closed", "status"]]);
  });

  it("svoj rešen zahtev potvrđuje (zatvoren) ili ponovo otvara (u obradi)", () => {
    expect(targets(ticket("t1", "resolved", AGENT.id), CUSTOMER)).toEqual([
      ["closed", "status"],
      ["in_progress", "status"],
    ]);
  });

  it("zahtev u obradi i tuđ zahtev se ne mogu prevući", () => {
    expect(targets(ticket("t1", "in_progress", AGENT.id), CUSTOMER)).toEqual([]);
    expect(targets(ticket("t1", "open", null, "drugi"), CUSTOMER)).toEqual([]);
  });
});

describe("boardDropTargets — agent", () => {
  it("svoj zahtev u obradi: čeka korisnika ili rešen", () => {
    expect(targets(ticket("t1", "in_progress", AGENT.id), AGENT)).toEqual([
      ["resolved", "status"],
      ["waiting_on_customer", "status"],
    ]);
  });

  it("tuđ zahtev (dodeljen drugom agentu) se ne može prevući", () => {
    expect(targets(ticket("t1", "in_progress", "a-2"), AGENT)).toEqual([]);
    expect(targets(ticket("t1", "open", "a-2"), AGENT)).toEqual([]);
  });

  it("nedodeljen otvoren zahtev u „U obradi“ = preuzimanje", () => {
    expect(targets(ticket("t1", "open"), AGENT)).toEqual([["in_progress", "claim"]]);
  });
});

describe("boardDropTargets — admin", () => {
  it("svi prelazi iz tabele, i bez dodele (open -> in_progress je promena statusa)", () => {
    const open = boardDropTargets(ticket("t1", "open"), ADMIN);
    expect(open.get("in_progress")).toBe("status");
    expect(open.has("closed")).toBe(true);
    expect(boardDropTargets(ticket("t1", "closed"), ADMIN).size).toBeGreaterThan(0);
  });
});

describe("needsDropConfirmation", () => {
  it("samo korisnik koji otkazuje otvoren zahtev", () => {
    expect(needsDropConfirmation("open", "closed", "customer")).toBe(true);
    expect(needsDropConfirmation("resolved", "closed", "customer")).toBe(false);
    expect(needsDropConfirmation("open", "closed", "admin")).toBe(false);
  });
});

describe("applyBoardMoves", () => {
  const columns: BoardColumnData[] = [
    {
      status: "open",
      items: [ticket("t1", "open"), ticket("t2", "open")],
      total: 5,
      showAllHref: "",
    },
    { status: "in_progress", items: [ticket("t3", "in_progress")], total: 1, showAllHref: "" },
  ];

  it("bez premeštanja kolone ostaju iste", () => {
    expect(applyBoardMoves(columns, {})).toEqual(columns);
  });

  it("premeštena kartica ide na vrh nove kolone, a brojevi se ispravljaju", () => {
    const [open, inProgress] = applyBoardMoves(columns, { t2: "in_progress" });
    if (!open || !inProgress) throw new Error("nedostaju kolone");
    expect(open.items.map((item) => item.id)).toEqual(["t1"]);
    expect(open.total).toBe(4);
    expect(inProgress.items.map((item) => [item.id, item.status])).toEqual([
      ["t2", "in_progress"],
      ["t3", "in_progress"],
    ]);
    expect(inProgress.total).toBe(2);
    // Ulaz se ne menja.
    expect(columns[0]?.items).toHaveLength(2);
  });
});

describe("prikaz u adresi", () => {
  it("?view=board je tabla, sve ostalo lista", () => {
    expect(parseTicketView({ view: "board" })).toBe("board");
    expect(parseTicketView({ view: ["board", "list"] })).toBe("board");
    expect(parseTicketView({ view: "xyz" })).toBe("list");
    expect(parseTicketView({})).toBe("list");
  });

  it("ticketListHref dodaje view=board, a lista se ne piše", () => {
    const query = parseTicketListParams({ priority: "high" });
    expect(ticketListHref(query, { view: "board" })).toBe("/tickets?priority=high&view=board");
    expect(ticketListHref(query, { view: "list" })).toBe("/tickets?priority=high");
    expect(ticketListHref(query, { status: "resolved", view: "list" })).toBe(
      "/tickets?status=resolved&priority=high",
    );
  });
});
