/**
 * RLS matrica, red `tickets` (docs/02-baza-podataka.md, sekcija 8).
 *
 *   SELECT: vlasnik vidi svoje; staff vidi sve; gost ništa
 *   INSERT: samo RPC create_ticket (samo customer)
 *   UPDATE: samo RPC (update_ticket, assign_ticket, change_ticket_status)
 *   DELETE: niko
 * Detaljna pravila RPC funkcija (ko sme koji prelaz itd.) su u
 * tests/integration/tickets-comments.test.ts, status-transitions.test.ts i
 * assign-rate-notifications.test.ts; ovde se proverava sama tabela.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  as,
  CATEGORY_ID,
  createTicket,
  expectDbError,
  expectDbOk,
  USERS,
  type TicketRow,
} from "../helpers";
import { asRole, expectNoRows, expectPermissionDenied, visibleRows } from "./rls-helpers";

/** Anin zahtev (vlasnik ana) za proveru pristupa. */
let ticket: TicketRow;

beforeAll(async () => {
  ticket = await createTicket("ana");
});

describe("tickets · SELECT", () => {
  it("SELECT · gost: nema pristup", async () => {
    await expectPermissionDenied(anonClient().from("tickets").select("id"));
  });

  it("SELECT · korisnik: vidi samo svoje zahteve", async () => {
    const ana = await asRole("customer");
    const rows = await visibleRows(ana.from("tickets").select("id, created_by"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.created_by === USERS.ana.id)).toBe(true);
  });

  it("SELECT · drugi korisnik: ne vidi tuđ zahtev ni po ID-ju", async () => {
    const marko = await as("marko");
    await expectNoRows(marko.from("tickets").select("id").eq("id", ticket.id));
  });

  it("SELECT · agent i admin: vide zahteve svih korisnika", async () => {
    for (const role of ["agent", "admin"] as const) {
      const client = await asRole(role);
      const rows = await visibleRows(client.from("tickets").select("id").eq("id", ticket.id));
      expect(rows).toEqual([{ id: ticket.id }]);
      const owners = await visibleRows(
        client.from("tickets").select("created_by").neq("created_by", USERS.ana.id).limit(1),
      );
      expect(owners.length).toBe(1);
    }
  });
});

describe("tickets · INSERT", () => {
  it("INSERT · svi: direktan upis nije dozvoljen", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("tickets").insert({
          title: "Direktan upis",
          description: "Pokušaj upisa mimo RPC funkcije.",
          category_id: CATEGORY_ID,
          created_by: USERS.ana.id,
        }),
      );
    }
  });

  it("INSERT · RPC create_ticket: korisnik sme, agent i admin ne smeju", async () => {
    const ana = await asRole("customer");
    const row = await expectDbOk(
      ana
        .rpc("create_ticket", {
          p_title: "RLS zahtev korisnika",
          p_description: "Zahtev koji pravi korisnik kroz RPC.",
          p_category_id: CATEGORY_ID,
        })
        .single<TicketRow>(),
    );
    expect(row.created_by).toBe(USERS.ana.id);

    for (const role of ["agent", "admin"] as const) {
      const client = await asRole(role);
      await expectDbError(
        client.rpc("create_ticket", {
          p_title: "RLS zahtev tima",
          p_description: "Tim podrške ne prijavljuje zahteve.",
          p_category_id: CATEGORY_ID,
        }),
        "FORBIDDEN",
      );
    }
  });
});

describe("tickets · UPDATE", () => {
  it("UPDATE · svi: direktna izmena nije dozvoljena (ni statusa ni dodele)", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("tickets").update({ status: "closed" }).eq("id", ticket.id),
      );
      await expectPermissionDenied(
        client.from("tickets").update({ assigned_to: USERS.agent.id }).eq("id", ticket.id),
      );
    }
  });

  it("UPDATE · RPC: drugi korisnik ne menja tuđ zahtev", async () => {
    const marko = await as("marko");
    await expectDbError(
      marko.rpc("update_ticket", { p_ticket_id: ticket.id, p_title: "Tuđi naslov" }),
      "TICKET_NOT_FOUND",
    );
    await expectDbError(
      marko.rpc("change_ticket_status", { p_ticket_id: ticket.id, p_new_status: "closed" }),
      "TICKET_NOT_FOUND",
    );
  });
});

describe("tickets · DELETE", () => {
  it("DELETE · svi: brisanje nije dozvoljeno", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(client.from("tickets").delete().eq("id", ticket.id));
    }
  });
});
