/**
 * RLS matrica, red `ticket_ratings` (docs/02-baza-podataka.md, sekcija 8).
 *
 *   SELECT: ko vidi zahtev (vlasnik i staff)
 *   INSERT: samo RPC rate_ticket (vlasnik, zahtev u statusu resolved/closed)
 *   UPDATE: niko
 *   DELETE: niko (ocena se daje jednom, FZ-16)
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

/** Anin rešen zahtev sa ocenom. */
let rated: TicketRow;

beforeAll(async () => {
  rated = await createTicketInStatus("resolved");
  const ana = await asRole("customer");
  await expectDbOk(
    ana.rpc("rate_ticket", { p_ticket_id: rated.id, p_score: 5, p_comment: "Odlično" }),
  );
});

describe("ticket_ratings · SELECT", () => {
  it("SELECT · gost: nema pristup", async () => {
    await expectPermissionDenied(anonClient().from("ticket_ratings").select("id"));
  });

  it("SELECT · vlasnik: vidi ocenu svog zahteva", async () => {
    const ana = await asRole("customer");
    const rows = await visibleRows(
      ana.from("ticket_ratings").select("score").eq("ticket_id", rated.id),
    );
    expect(rows).toEqual([{ score: 5 }]);
  });

  it("SELECT · drugi korisnik: ne vidi ocene tuđih zahteva", async () => {
    const marko = await as("marko");
    await expectNoRows(marko.from("ticket_ratings").select("id").eq("ticket_id", rated.id));
  });

  it("SELECT · agent i admin: vide ocene", async () => {
    for (const role of ["agent", "admin"] as const) {
      const client = await asRole(role);
      const rows = await visibleRows(
        client.from("ticket_ratings").select("score").eq("ticket_id", rated.id),
      );
      expect(rows).toEqual([{ score: 5 }]);
    }
  });
});

describe("ticket_ratings · INSERT", () => {
  it("INSERT · svi: direktan upis nije dozvoljen", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client
          .from("ticket_ratings")
          .insert({ ticket_id: rated.id, rated_by: USERS.ana.id, score: 1 }),
      );
    }
  });

  it("INSERT · RPC rate_ticket: samo vlasnik, samo rešen zahtev", async () => {
    const resolved = await createTicketInStatus("resolved");
    // Agent i admin ne ocenjuju.
    for (const role of ["agent", "admin"] as const) {
      const client = await asRole(role);
      await expectDbError(
        client.rpc("rate_ticket", { p_ticket_id: resolved.id, p_score: 3 }),
        "FORBIDDEN",
      );
    }
    // Zahtev koji još nije rešen se ne ocenjuje.
    const open = await createTicketInStatus("in_progress");
    const ana = await asRole("customer");
    await expectDbError(
      ana.rpc("rate_ticket", { p_ticket_id: open.id, p_score: 3 }),
      "TICKET_NOT_RESOLVED",
    );
  });
});

describe("ticket_ratings · UPDATE i DELETE", () => {
  it("UPDATE · svi: ocena se ne menja", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("ticket_ratings").update({ score: 1 }).eq("ticket_id", rated.id),
      );
    }
  });

  it("DELETE · svi: ocena se ne briše", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("ticket_ratings").delete().eq("ticket_id", rated.id),
      );
    }
  });
});
