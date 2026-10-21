/**
 * RLS matrica, red `profiles` (docs/02-baza-podataka.md, sekcija 8).
 *
 *   SELECT: svoj red; staff vidi sve; gost ništa
 *   INSERT: samo triger handle_new_user (niko direktno)
 *   UPDATE: svoj red, samo full_name, avatar_url, locale; uloga i aktivnost
 *           samo kroz RPC admin_update_user
 *   DELETE: niko (deaktivacija umesto brisanja)
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { anonClient, expectNoDbError, USERS } from "../helpers";
import {
  asRole,
  createTempUser,
  deleteTempUsers,
  expectNoRows,
  expectPermissionDenied,
  visibleRows,
} from "./rls-helpers";

/** Privremeni nalozi napravljeni u ovom fajlu (brišu se na kraju). */
const created: string[] = [];
afterAll(() => deleteTempUsers(created));

describe("profiles · SELECT", () => {
  it("SELECT · gost: nema pristup", async () => {
    await expectPermissionDenied(anonClient().from("profiles").select("id"));
  });

  it("SELECT · korisnik: vidi samo svoj red", async () => {
    const ana = await asRole("customer");
    const rows = await visibleRows(ana.from("profiles").select("id"));
    expect(rows).toEqual([{ id: USERS.ana.id }]);
    // Tuđ profil se ne vidi ni kad se traži po ID-ju.
    await expectNoRows(ana.from("profiles").select("id").eq("id", USERS.marko.id));
  });

  it("SELECT · agent i admin: vide sve profile", async () => {
    for (const role of ["agent", "admin"] as const) {
      const client = await asRole(role);
      const ids = (await visibleRows(client.from("profiles").select("id"))).map((row) => row.id);
      expect(ids).toEqual(expect.arrayContaining(Object.values(USERS).map((user) => user.id)));
    }
  });
});

describe("profiles · INSERT", () => {
  it("INSERT · svi: direktan upis nije dozvoljen", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("profiles").insert({
          id: randomUUID(),
          email: "uljez@helpdesk.test",
          full_name: "Uljez",
          role: "admin",
        }),
      );
    }
    await expectPermissionDenied(
      anonClient()
        .from("profiles")
        .insert({ id: randomUUID(), email: "gost@helpdesk.test", full_name: "Gost" }),
    );
  });

  it("INSERT · triger: nov nalog dobija profil sa ulogom customer", async () => {
    const temp = await createTempUser(created);
    const rows = await visibleRows(temp.client.from("profiles").select("id, role, is_active"));
    expect(rows).toEqual([{ id: temp.id, role: "customer", is_active: true }]);
  });
});

describe("profiles · UPDATE", () => {
  it("UPDATE · korisnik: menja svoje ime, avatar i jezik", async () => {
    const temp = await createTempUser(created);
    await expectNoDbError(
      temp.client
        .from("profiles")
        .update({ full_name: "Novo Ime", avatar_url: null, locale: "en" })
        .eq("id", temp.id),
    );
    const [row] = await visibleRows(temp.client.from("profiles").select("full_name, locale"));
    expect(row).toEqual({ full_name: "Novo Ime", locale: "en" });
  });

  it("UPDATE · svi: tuđ profil se ne menja (ni agent ni admin direktno)", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectNoRows(
        client
          .from("profiles")
          .update({ full_name: "Promenjeno" })
          .eq("id", USERS.marko.id)
          .select("id"),
      );
    }
  });

  it("UPDATE · svi: uloga i aktivnost se ne menjaju direktno (samo RPC admin_update_user)", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      const ownId = USERS[role === "customer" ? "ana" : role].id;
      await expectPermissionDenied(
        client.from("profiles").update({ role: "admin" }).eq("id", ownId),
      );
      await expectPermissionDenied(
        client.from("profiles").update({ is_active: false }).eq("id", ownId),
      );
    }
  });
});

describe("profiles · DELETE", () => {
  it("DELETE · svi: brisanje profila nije dozvoljeno", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(client.from("profiles").delete().eq("id", USERS.marko.id));
    }
  });
});
