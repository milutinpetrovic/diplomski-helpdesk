/**
 * Integracioni testovi: tabela dozvoljenih prelaza statusa.
 *
 * Za svaku ulogu i svaki par statusa (iz -> u) pravi se zahtev u statusu "iz"
 * i poziva change_ticket_status. Očekivani rezultat je tabela iz
 * docs/02-baza-podataka.md, sekcija 4 (ista tabela ide u rad kao primer RBAC-a).
 *   - korisnik = vlasnik zahteva (Ana)
 *   - agent    = agent kome je zahtev dodeljen
 *   - admin
 * Proverava i vremenske oznake resolved_at / closed_at.
 */
import { describe, expect, it } from "vitest";
import {
  as,
  createTicketInStatus,
  expectDbError,
  expectDbOk,
  type SeedUser,
  type TicketRow,
  type TicketStatus,
} from "./helpers";

const STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "waiting_on_customer",
  "resolved",
  "closed",
];

/** Dozvoljeni prelazi po ulozi, u obliku "iz>u" (docs/02, sekcija 4). */
const ALLOWED: Record<"customer" | "agent" | "admin", string[]> = {
  customer: ["open>closed", "resolved>closed", "resolved>in_progress"],
  agent: [
    "in_progress>waiting_on_customer",
    "waiting_on_customer>in_progress",
    "in_progress>resolved",
    "waiting_on_customer>resolved",
    "resolved>in_progress",
  ],
  admin: [
    "open>in_progress",
    "open>closed",
    "in_progress>waiting_on_customer",
    "waiting_on_customer>in_progress",
    "in_progress>resolved",
    "waiting_on_customer>resolved",
    "resolved>closed",
    "resolved>in_progress",
    "closed>open",
  ],
};

/** Koji demo nalog igra koju ulogu u ovom testu. */
const ACTOR: Record<keyof typeof ALLOWED, SeedUser> = {
  customer: "ana",
  agent: "agent",
  admin: "admin",
};

// Svi parovi (uloga, iz, u) gde je iz != u.
const cases = (Object.keys(ALLOWED) as (keyof typeof ALLOWED)[]).flatMap((role) =>
  STATUSES.flatMap((from) =>
    STATUSES.filter((to) => to !== from).map((to) => ({ role, from, to })),
  ),
);

describe("change_ticket_status: tabela prelaza", () => {
  it.each(cases)("$role: $from -> $to", async ({ role, from, to }) => {
    // Korak 1: zahtev u početnom statusu (za open nije dodeljen nikome).
    const ticket = await createTicketInStatus(from);
    const client = await as(ACTOR[role]);
    const call = client.rpc("change_ticket_status", { p_ticket_id: ticket.id, p_new_status: to });

    // Korak 2: agent na nedodeljenom (open) zahtevu dobija NOT_ASSIGNED_AGENT.
    if (role === "agent" && from === "open") {
      await expectDbError(call, "NOT_ASSIGNED_AGENT");
      return;
    }

    // Korak 3: dozvoljen prelaz uspeva, ostali vraćaju INVALID_STATUS_TRANSITION.
    if (ALLOWED[role].includes(`${from}>${to}`)) {
      const updated = await expectDbOk(call.single<TicketRow>());
      expect(updated.status).toBe(to);
    } else {
      await expectDbError(call, "INVALID_STATUS_TRANSITION");
    }
  });
});

describe("vremenske oznake", () => {
  // resolved -> resolved_at; closed -> closed_at (resolved_at ostaje);
  // ponovno otvaranje briše obe.
  it("resolved_at i closed_at prate status", async () => {
    const ticket = await createTicketInStatus("resolved");
    expect(ticket.resolved_at).not.toBeNull();
    expect(ticket.closed_at).toBeNull();

    const admin = await as("admin");
    const closed = await expectDbOk(
      admin
        .rpc("change_ticket_status", { p_ticket_id: ticket.id, p_new_status: "closed" })
        .single<TicketRow>(),
    );
    expect(closed.closed_at).not.toBeNull();
    expect(closed.resolved_at).not.toBeNull();

    const reopened = await expectDbOk(
      admin
        .rpc("change_ticket_status", { p_ticket_id: ticket.id, p_new_status: "open" })
        .single<TicketRow>(),
    );
    expect(reopened.resolved_at).toBeNull();
    expect(reopened.closed_at).toBeNull();
  });

  // Drugi agent (nije dodeljen) ne menja status.
  it("nedodeljen agent ne menja status", async () => {
    const ticket = await createTicketInStatus("in_progress");
    const agent2 = await as("agent2");
    await expectDbError(
      agent2.rpc("change_ticket_status", { p_ticket_id: ticket.id, p_new_status: "resolved" }),
      "NOT_ASSIGNED_AGENT",
    );
  });
});
