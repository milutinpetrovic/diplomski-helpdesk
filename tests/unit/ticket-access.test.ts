/**
 * Unit testovi: TicketAccessPolicy (src/services/policies/ticket-access.ts).
 *
 * Proverava ko sme da vidi, komentariše, dodeli, izmeni i oceni zahtev, i
 * da polje permissions odgovara ulozi i statusu (po njemu UI prikazuje dugmad).
 * Ista pravila postoje u bazi (RLS i RPC funkcije) i tamo ih proveravaju
 * integracioni testovi.
 */
import { describe, expect, it } from "vitest";

import { AuthContext } from "@/lib/auth/auth-context";
import { TicketAccessPolicy, type TicketAccessInfo } from "@/services/policies/ticket-access";
import type { TicketStatus } from "@/types/domain";

const policy = new TicketAccessPolicy();

const ANA = new AuthContext("ana", "customer", "sr");
const MARKO = new AuthContext("marko", "customer", "sr");
const AGENT = new AuthContext("agent", "agent", "sr");
const AGENT2 = new AuthContext("agent2", "agent", "sr");
const ADMIN = new AuthContext("admin", "admin", "sr");

/** Anin zahtev u datom statusu, dodeljen agentu `agent` (ili nikome). */
function ticket(status: TicketStatus, assignedTo: string | null = "agent"): TicketAccessInfo {
  return { status, createdBy: "ana", assignedTo };
}

/** Očekuje AppError sa datim kodom. */
function expectCode(fn: () => void, code: string) {
  expect(fn).toThrow(expect.objectContaining({ code }));
}

describe("TicketAccessPolicy: pregled i komentari", () => {
  it("zahtev vide vlasnik i tim, ne drugi korisnik", () => {
    expect(policy.canView(ticket("open"), ANA)).toBe(true);
    expect(policy.canView(ticket("open"), AGENT2)).toBe(true);
    expect(policy.canView(ticket("open"), MARKO)).toBe(false);
  });

  it("interna beleška samo za tim; zatvoren zahtev se ne komentariše", () => {
    expect(policy.canComment(ticket("in_progress"), ANA, false)).toBe(true);
    expect(policy.canComment(ticket("in_progress"), ANA, true)).toBe(false);
    expect(policy.canComment(ticket("in_progress"), AGENT2, true)).toBe(true);
    expect(policy.canComment(ticket("closed"), AGENT, false)).toBe(false);

    expectCode(
      () => policy.assertCanComment(ticket("open"), ANA, true),
      "FORBIDDEN_INTERNAL_COMMENT",
    );
    expectCode(() => policy.assertCanComment(ticket("closed"), AGENT, false), "TICKET_CLOSED");
    expect(() => policy.assertCanComment(ticket("open"), ANA, false)).not.toThrow();
  });
});

describe("TicketAccessPolicy: dodela", () => {
  it("agent preuzima samo nedodeljen zahtev, i to samo za sebe", () => {
    expect(policy.canAssign(ticket("open", null), AGENT)).toBe(true);
    expect(policy.canAssign(ticket("open", null), AGENT, "agent")).toBe(true);
    expect(policy.canAssign(ticket("open", null), AGENT, "agent2")).toBe(false);
    expect(policy.canAssign(ticket("in_progress", "agent2"), AGENT)).toBe(false);

    expectCode(() => policy.assertCanAssign(ticket("open", null), AGENT, "agent2"), "FORBIDDEN");
    expectCode(() => policy.assertCanAssign(ticket("open", null), AGENT, null), "FORBIDDEN");
    expectCode(
      () => policy.assertCanAssign(ticket("in_progress", "agent2"), AGENT, "agent"),
      "TICKET_ALREADY_ASSIGNED",
    );
  });

  it("admin dodeljuje bilo kome i oslobađa; zatvoren zahtev se ne dodeljuje", () => {
    expect(policy.canAssign(ticket("in_progress"), ADMIN)).toBe(true);
    expect(() => policy.assertCanAssign(ticket("in_progress"), ADMIN, null)).not.toThrow();
    expect(policy.canAssign(ticket("closed"), ADMIN)).toBe(false);
    expectCode(() => policy.assertCanAssign(ticket("closed"), ADMIN, "agent"), "TICKET_CLOSED");
  });

  it("korisnik ne dodeljuje", () => {
    expect(policy.canAssign(ticket("open", null), ANA)).toBe(false);
    expectCode(() => policy.assertCanAssign(ticket("open", null), ANA, "ana"), "FORBIDDEN");
  });
});

describe("TicketAccessPolicy: izmena", () => {
  it("korisnik menja samo naslov i opis svog otvorenog zahteva", () => {
    expect(policy.canEdit(ticket("open", null), ANA)).toBe(true);
    expect(() => policy.assertCanEdit(ticket("open", null), ANA, ["title"])).not.toThrow();
    expectCode(() => policy.assertCanEdit(ticket("open", null), ANA, ["priority"]), "FORBIDDEN");
    expectCode(() => policy.assertCanEdit(ticket("in_progress"), ANA, ["title"]), "FORBIDDEN");
  });

  it("agent menja samo dodeljen zahtev; admin svaki osim zatvorenog", () => {
    expect(policy.canEdit(ticket("in_progress"), AGENT)).toBe(true);
    expect(policy.canEdit(ticket("in_progress"), AGENT2)).toBe(false);
    expectCode(
      () => policy.assertCanEdit(ticket("in_progress"), AGENT2, ["priority"]),
      "NOT_ASSIGNED_AGENT",
    );
    expect(policy.canEdit(ticket("resolved"), ADMIN)).toBe(true);
    expectCode(() => policy.assertCanEdit(ticket("closed"), ADMIN, ["priority"]), "TICKET_CLOSED");
  });
});

describe("TicketAccessPolicy: ocena", () => {
  it("samo vlasnik, samo rešen ili zatvoren zahtev, samo jednom", () => {
    expect(policy.canRate(ticket("resolved"), ANA, false)).toBe(true);
    expect(policy.canRate(ticket("closed"), ANA, false)).toBe(true);
    expect(policy.canRate(ticket("resolved"), ANA, true)).toBe(false);
    expect(policy.canRate(ticket("in_progress"), ANA, false)).toBe(false);
    expect(policy.canRate(ticket("resolved"), AGENT, false)).toBe(false);

    expectCode(() => policy.assertCanRate(ticket("resolved"), AGENT, false), "FORBIDDEN");
    expectCode(() => policy.assertCanRate(ticket("open"), ANA, false), "TICKET_NOT_RESOLVED");
    expectCode(() => policy.assertCanRate(ticket("resolved"), ANA, true), "ALREADY_RATED");
  });
});

describe("TicketAccessPolicy: permissions za interfejs", () => {
  it("korisnik na rešenom zahtevu: potvrda, ponovno otvaranje i ocena", () => {
    expect(policy.permissionsFor(ticket("resolved"), ANA, false)).toEqual({
      allowedTransitions: ["closed", "in_progress"],
      canComment: true,
      canCommentInternal: false,
      canAssign: false,
      canRate: true,
      canEdit: false,
    });
  });

  it("dodeljeni agent na zahtevu u obradi", () => {
    expect(policy.permissionsFor(ticket("in_progress"), AGENT, false)).toEqual({
      allowedTransitions: ["waiting_on_customer", "resolved"],
      canComment: true,
      canCommentInternal: true,
      canAssign: false,
      canRate: false,
      canEdit: true,
    });
  });

  it("drugi agent na nedodeljenom zahtevu: samo preuzimanje i komentari", () => {
    expect(policy.permissionsFor(ticket("open", null), AGENT2, false)).toEqual({
      allowedTransitions: [],
      canComment: true,
      canCommentInternal: true,
      canAssign: true,
      canRate: false,
      canEdit: false,
    });
  });

  it("admin na zatvorenom zahtevu: samo ponovno otvaranje", () => {
    expect(policy.permissionsFor(ticket("closed"), ADMIN, true)).toEqual({
      allowedTransitions: ["open"],
      canComment: false,
      canCommentInternal: false,
      canAssign: false,
      canRate: false,
      canEdit: false,
    });
  });
});
