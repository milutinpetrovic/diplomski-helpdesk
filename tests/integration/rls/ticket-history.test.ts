/**
 * RLS matrica, red `ticket_history` (docs/02-baza-podataka.md, sekcija 8).
 *
 *   SELECT: ko vidi zahtev (vlasnik i staff); istorija ne sadrži tekst komentara
 *   INSERT: samo RPC (istoriju upisuju RPC funkcije same)
 *   UPDATE: niko
 *   DELETE: niko (istorija se ne može prepraviti — audit log, FZ-9)
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  as,
  createTicketInStatus,
  expectDbOk,
  USERS,
  type TicketRow,
} from "../helpers";
import { asRole, expectNoRows, expectPermissionDenied, visibleRows } from "./rls-helpers";

/** Anin zahtev u obradi, sa internom beleškom čiji tekst ne sme da se pojavi u istoriji. */
let ticket: TicketRow;
const SECRET = "Tajni tekst interne beleške RLS";

beforeAll(async () => {
  ticket = await createTicketInStatus("in_progress");
  const agent = await asRole("agent");
  await expectDbOk(
    agent.rpc("add_comment", { p_ticket_id: ticket.id, p_body: SECRET, p_is_internal: true }),
  );
});

describe("ticket_history · SELECT", () => {
  it("SELECT · gost: nema pristup", async () => {
    await expectPermissionDenied(anonClient().from("ticket_history").select("id"));
  });

  it("SELECT · vlasnik zahteva: vidi istoriju svog zahteva", async () => {
    const ana = await asRole("customer");
    const rows = await visibleRows(
      ana.from("ticket_history").select("action").eq("ticket_id", ticket.id),
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("SELECT · drugi korisnik: ne vidi istoriju tuđeg zahteva", async () => {
    const marko = await as("marko");
    await expectNoRows(marko.from("ticket_history").select("id").eq("ticket_id", ticket.id));
  });

  it("SELECT · agent i admin: vide istoriju", async () => {
    for (const role of ["agent", "admin"] as const) {
      const client = await asRole(role);
      const rows = await visibleRows(
        client.from("ticket_history").select("id").eq("ticket_id", ticket.id),
      );
      expect(rows.length).toBeGreaterThan(0);
    }
  });

  it("SELECT · istorija ne sadrži tekst komentara (ni interne beleške)", async () => {
    const admin = await asRole("admin");
    const rows = await visibleRows(
      admin.from("ticket_history").select("*").eq("ticket_id", ticket.id),
    );
    expect(JSON.stringify(rows)).not.toContain(SECRET);
  });
});

describe("ticket_history · INSERT, UPDATE, DELETE", () => {
  it("INSERT · svi: direktan upis nije dozvoljen", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("ticket_history").insert({
          ticket_id: ticket.id,
          actor_id: USERS.admin.id,
          action: "status_changed",
        }),
      );
    }
  });

  it("UPDATE · svi: istorija se ne menja", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("ticket_history").update({ new_value: "x" }).eq("ticket_id", ticket.id),
      );
    }
  });

  it("DELETE · svi: istorija se ne briše", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("ticket_history").delete().eq("ticket_id", ticket.id),
      );
    }
  });
});
