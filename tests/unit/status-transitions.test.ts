/**
 * Unit testovi: StatusTransitionPolicy (src/services/policies/status-transitions.ts).
 *
 * Kriterijum Faze 5 (docs/07): test za SVAKI red tabele prelaza, za svaku
 * ulogu. Očekivane vrednosti su prepisane iz tabele u docs/02, sekcija 4
 * (ista tabela ide u pisani rad), pa test pada ako se kod i dokumentacija raziđu.
 */
import { describe, expect, it } from "vitest";

import {
  STATUS_TRANSITIONS,
  StatusTransitionPolicy,
  type TransitionActor,
} from "@/services/policies/status-transitions";
import { TICKET_STATUSES, type TicketStatus } from "@/types/domain";

const policy = new StatusTransitionPolicy();

/** Akteri sa „pravim“ odnosom prema zahtevu (vlasnik, dodeljen agent, admin). */
const OWNER: TransitionActor = { role: "customer", isOwner: true, isAssignee: false };
const ASSIGNEE: TransitionActor = { role: "agent", isOwner: false, isAssignee: true };
const ADMIN: TransitionActor = { role: "admin", isOwner: false, isAssignee: false };

/**
 * Tabela iz docs/02, sekcija 4: [iz, u, korisnik, agent, admin].
 * „automatski“ i „kroz preuzimanje“ nisu ručni prelazi, pa su ovde false.
 */
const EXPECTED: [TicketStatus, TicketStatus, boolean, boolean, boolean][] = [
  ["open", "in_progress", false, false, true],
  ["open", "closed", true, false, true],
  ["in_progress", "waiting_on_customer", false, true, true],
  ["waiting_on_customer", "in_progress", false, true, true],
  ["in_progress", "resolved", false, true, true],
  ["waiting_on_customer", "resolved", false, true, true],
  ["resolved", "closed", true, false, true],
  ["resolved", "in_progress", true, true, true],
  ["closed", "open", false, false, true],
];

describe("StatusTransitionPolicy: tabela prelaza", () => {
  it("kod sadrži tačno redove iz dokumentacije", () => {
    expect(STATUS_TRANSITIONS.map((r) => [r.from, r.to, r.customer, r.agent, r.admin])).toEqual(
      EXPECTED,
    );
  });

  describe.each(EXPECTED)("%s -> %s", (from, to, customer, agent, admin) => {
    it(`korisnik (vlasnik): ${customer ? "da" : "ne"}`, () => {
      expect(policy.canTransition(from, to, OWNER)).toBe(customer);
    });
    it(`agent (dodeljen): ${agent ? "da" : "ne"}`, () => {
      expect(policy.canTransition(from, to, ASSIGNEE)).toBe(agent);
    });
    it(`admin: ${admin ? "da" : "ne"}`, () => {
      expect(policy.canTransition(from, to, ADMIN)).toBe(admin);
    });
    it("korisnik koji nije vlasnik i agent koji nije dodeljen: ne", () => {
      expect(policy.canTransition(from, to, { ...OWNER, isOwner: false })).toBe(false);
      expect(policy.canTransition(from, to, { ...ASSIGNEE, isAssignee: false })).toBe(false);
    });
  });

  it("parovi koji nisu u tabeli nisu dozvoljeni nikome", () => {
    const listed = new Set(EXPECTED.map(([from, to]) => `${from}>${to}`));
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        if (listed.has(`${from}>${to}`)) continue;
        for (const actor of [OWNER, ASSIGNEE, ADMIN]) {
          expect(policy.canTransition(from, to, actor), `${from}>${to} ${actor.role}`).toBe(false);
        }
      }
    }
  });
});

describe("StatusTransitionPolicy: allowedTargets i assertTransition", () => {
  it("dozvoljeni ciljevi po ulozi (za dugmad u interfejsu)", () => {
    expect(policy.allowedTargets("open", OWNER)).toEqual(["closed"]);
    expect(policy.allowedTargets("resolved", OWNER)).toEqual(["closed", "in_progress"]);
    expect(policy.allowedTargets("in_progress", ASSIGNEE)).toEqual([
      "waiting_on_customer",
      "resolved",
    ]);
    expect(policy.allowedTargets("open", ASSIGNEE)).toEqual([]);
    expect(policy.allowedTargets("closed", ADMIN)).toEqual(["open"]);
    expect(policy.allowedTargets("closed", OWNER)).toEqual([]);
  });

  it("agent koji nije dodeljen dobija NOT_ASSIGNED_AGENT", () => {
    expect(() =>
      policy.assertTransition("in_progress", "resolved", { ...ASSIGNEE, isAssignee: false }),
    ).toThrow(expect.objectContaining({ code: "NOT_ASSIGNED_AGENT" }));
  });

  it("nedozvoljen prelaz daje INVALID_STATUS_TRANSITION", () => {
    expect(() => policy.assertTransition("open", "resolved", OWNER)).toThrow(
      expect.objectContaining({ code: "INVALID_STATUS_TRANSITION", httpStatus: 409 }),
    );
    expect(() => policy.assertTransition("in_progress", "resolved", ASSIGNEE)).not.toThrow();
  });
});
