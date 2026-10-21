/**
 * RLS matrica, red `ticket_comments` (docs/02-baza-podataka.md, sekcija 8).
 *
 *   SELECT: vlasnik zahteva vidi JAVNE komentare svog zahteva; staff vidi sve
 *           (i interne beleške); drugi korisnik i gost ništa
 *   INSERT: samo RPC add_comment (korisnik samo is_internal = false)
 *   UPDATE: niko
 *   DELETE: niko
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  as,
  createTicketInStatus,
  expectDbError,
  expectDbOk,
  USERS,
  type TicketRow,
} from "../helpers";
import { asRole, expectNoRows, expectPermissionDenied, visibleRows } from "./rls-helpers";

/** Anin zahtev u obradi, sa jednim javnim komentarom i jednom internom beleškom. */
let ticket: TicketRow;
/** ID interne beleške agenta. */
let internalId = "";

beforeAll(async () => {
  ticket = await createTicketInStatus("in_progress");
  const agent = await asRole("agent");
  await expectDbOk(
    agent.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Javni odgovor RLS" }),
  );
  const note = await expectDbOk(
    agent
      .rpc("add_comment", {
        p_ticket_id: ticket.id,
        p_body: "Interna beleška RLS",
        p_is_internal: true,
      })
      .single<{ id: string }>(),
  );
  internalId = note.id;
});

describe("ticket_comments · SELECT", () => {
  it("SELECT · gost: nema pristup", async () => {
    await expectPermissionDenied(anonClient().from("ticket_comments").select("id"));
  });

  it("SELECT · vlasnik zahteva: vidi javne komentare, ne vidi interne beleške", async () => {
    const ana = await asRole("customer");
    const rows = await visibleRows(
      ana.from("ticket_comments").select("body, is_internal").eq("ticket_id", ticket.id),
    );
    expect(rows).toEqual([{ body: "Javni odgovor RLS", is_internal: false }]);
    // Interna beleška se ne vidi ni kad se traži po ID-ju.
    await expectNoRows(ana.from("ticket_comments").select("id").eq("id", internalId));
    // Nijedan interni komentar ni na jednom zahtevu.
    await expectNoRows(ana.from("ticket_comments").select("id").eq("is_internal", true));
  });

  it("SELECT · drugi korisnik: ne vidi komentare tuđeg zahteva", async () => {
    const marko = await as("marko");
    await expectNoRows(marko.from("ticket_comments").select("id").eq("ticket_id", ticket.id));
  });

  it("SELECT · agent i admin: vide javne i interne komentare", async () => {
    for (const role of ["agent", "admin"] as const) {
      const client = await asRole(role);
      const rows = await visibleRows(
        client.from("ticket_comments").select("is_internal").eq("ticket_id", ticket.id),
      );
      expect(rows.map((row) => row.is_internal).sort()).toEqual([false, true]);
    }
  });
});

describe("ticket_comments · INSERT", () => {
  it("INSERT · svi: direktan upis nije dozvoljen", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("ticket_comments").insert({
          ticket_id: ticket.id,
          author_id: USERS.ana.id,
          body: "Direktan upis",
        }),
      );
    }
  });

  it("INSERT · RPC add_comment: korisnik ne može da napiše internu belešku", async () => {
    const ana = await asRole("customer");
    await expectDbError(
      ana.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Tajna", p_is_internal: true }),
      "FORBIDDEN_INTERNAL_COMMENT",
    );
  });

  it("INSERT · RPC add_comment: drugi korisnik ne komentariše tuđ zahtev", async () => {
    const marko = await as("marko");
    await expectDbError(
      marko.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Upad" }),
      "TICKET_NOT_FOUND",
    );
  });
});

describe("ticket_comments · UPDATE i DELETE", () => {
  it("UPDATE · svi: izmena komentara nije dozvoljena", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("ticket_comments").update({ body: "Izmenjeno" }).eq("id", internalId),
      );
    }
  });

  it("DELETE · svi: brisanje komentara nije dozvoljeno", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(client.from("ticket_comments").delete().eq("id", internalId));
    }
  });
});
