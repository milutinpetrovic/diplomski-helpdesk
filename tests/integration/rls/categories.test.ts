/**
 * RLS matrica, red `categories` (docs/02-baza-podataka.md, sekcija 8).
 *
 *   SELECT: svi prijavljeni vide aktivne; admin vidi sve; gost ništa
 *   INSERT: admin
 *   UPDATE: admin
 *   DELETE: niko (deaktivacija umesto brisanja)
 * Test pravi jednu neaktivnu i jednu novu kategoriju; na kraju ih briše
 * service_role klijent (samo čišćenje, ne provera prava).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient, CATEGORY_ID, expectDbOk, serviceClient } from "../helpers";
import { asRole, expectNoRows, expectPermissionDenied, visibleRows } from "./rls-helpers";

/** Kategorije napravljene u ovom fajlu (brišu se na kraju). */
const createdIds: string[] = [];

/** Podaci za novu kategoriju sa jedinstvenom oznakom. */
function newCategory() {
  const slug = `rls-${randomUUID().slice(0, 8)}`;
  return { slug, name_sr: `RLS ${slug}`, name_en: `RLS ${slug}`, sort_order: 99 };
}

/** ID neaktivne kategorije (pravi je admin pre testova). */
let inactiveId = "";

beforeAll(async () => {
  // Priprema: admin pravi kategoriju i deaktivira je.
  const admin = await asRole("admin");
  const row = await expectDbOk(
    admin
      .from("categories")
      .insert({ ...newCategory(), is_active: false })
      .select("id")
      .single(),
  );
  inactiveId = row.id;
  createdIds.push(row.id);
});

afterAll(async () => {
  // Čišćenje (DELETE nema niko, pa ide preko service_role).
  if (createdIds.length) await serviceClient().from("categories").delete().in("id", createdIds);
});

describe("categories · SELECT", () => {
  it("SELECT · gost: nema pristup", async () => {
    await expectPermissionDenied(anonClient().from("categories").select("id"));
  });

  it("SELECT · korisnik i agent: vide aktivne, ne vide neaktivne", async () => {
    for (const role of ["customer", "agent"] as const) {
      const client = await asRole(role);
      const rows = await visibleRows(client.from("categories").select("id, is_active"));
      expect(rows.map((row) => row.id)).toContain(CATEGORY_ID);
      expect(rows.every((row) => row.is_active)).toBe(true);
      await expectNoRows(client.from("categories").select("id").eq("id", inactiveId));
    }
  });

  it("SELECT · admin: vidi i neaktivne", async () => {
    const admin = await asRole("admin");
    const rows = await visibleRows(admin.from("categories").select("id").eq("id", inactiveId));
    expect(rows).toEqual([{ id: inactiveId }]);
  });
});

describe("categories · INSERT", () => {
  it("INSERT · korisnik i agent: odbijeno", async () => {
    for (const role of ["customer", "agent"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(client.from("categories").insert(newCategory()));
    }
  });

  it("INSERT · admin: dozvoljeno", async () => {
    const admin = await asRole("admin");
    const row = await expectDbOk(
      admin.from("categories").insert(newCategory()).select("id").single(),
    );
    createdIds.push(row.id);
  });
});

describe("categories · UPDATE", () => {
  it("UPDATE · korisnik i agent: ne menjaju nijedan red", async () => {
    for (const role of ["customer", "agent"] as const) {
      const client = await asRole(role);
      await expectNoRows(
        client.from("categories").update({ sort_order: 1 }).eq("id", CATEGORY_ID).select("id"),
      );
    }
  });

  it("UPDATE · admin: menja i aktivira kategoriju", async () => {
    const admin = await asRole("admin");
    const row = await expectDbOk(
      admin
        .from("categories")
        .update({ is_active: true })
        .eq("id", inactiveId)
        .select("is_active")
        .single(),
    );
    expect(row.is_active).toBe(true);
    // Vraćamo je u neaktivno stanje (ne utiče na druge testove).
    await expectDbOk(
      admin.from("categories").update({ is_active: false }).eq("id", inactiveId).select("id"),
    );
  });
});

describe("categories · DELETE", () => {
  it("DELETE · svi (i admin): brisanje nije dozvoljeno", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(client.from("categories").delete().eq("id", inactiveId));
    }
  });
});
