/**
 * Integracioni testovi: profili, pogled profile_summaries i kategorije (RLS).
 *
 * Proverava RLS matricu iz docs/02-baza-podataka.md (sekcija 8) za tabele
 * profiles i categories, triger handle_new_user i zaštitu od promene uloge.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { anonClient, as, expectDbOk, serviceClient, USERS } from "./helpers";

describe("profiles", () => {
  // Korisnik vidi samo svoj profil (RLS profiles_select_own_or_staff).
  it("korisnik vidi samo svoj profil", async () => {
    const ana = await as("ana");
    const rows = await expectDbOk(ana.from("profiles").select("id, role"));
    expect(rows).toEqual([{ id: USERS.ana.id, role: "customer" }]);
  });

  // Agent i admin vide sve profile (potrebno za listu korisnika i dodelu).
  it("agent i admin vide sve profile", async () => {
    for (const user of ["agent", "admin"] as const) {
      const client = await as(user);
      const rows = await expectDbOk(client.from("profiles").select("id"));
      expect(rows.map((row) => row.id)).toEqual(
        expect.arrayContaining(Object.values(USERS).map((u) => u.id)),
      );
    }
  });

  // Gost ne vidi nijedan profil (nema prava na tabelu).
  it("gost nema pristup profilima", async () => {
    const { data, error } = await anonClient().from("profiles").select("id");
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe("42501");
  });

  // Korisnik sme da promeni svoje ime i jezik.
  it("korisnik menja svoje ime i jezik", async () => {
    const marko = await as("marko");
    const updated = await expectDbOk(
      marko
        .from("profiles")
        .update({ full_name: "Marko M.", locale: "en" })
        .eq("id", USERS.marko.id)
        .select("full_name, locale")
        .single(),
    );
    expect(updated).toEqual({ full_name: "Marko M.", locale: "en" });
    // Vraćamo staro ime da ne utiče na druge testove.
    await expectDbOk(
      marko
        .from("profiles")
        .update({ full_name: "Marko Marković", locale: "sr" })
        .eq("id", USERS.marko.id),
    );
  });

  // Korisnik NE sme sebi da promeni ulogu (pravo na kolonu role ne postoji).
  it("korisnik ne može sebi da dodeli ulogu admin", async () => {
    const ana = await as("ana");
    const { error } = await ana.from("profiles").update({ role: "admin" }).eq("id", USERS.ana.id);
    expect(error?.code).toBe("42501");
  });

  // Korisnik ne može da menja tuđi profil (RLS ga ne pušta do reda).
  it("korisnik ne menja tuđi profil", async () => {
    const ana = await as("ana");
    const { data } = await ana
      .from("profiles")
      .update({ full_name: "Hakovano" })
      .eq("id", USERS.marko.id)
      .select("id");
    expect(data).toEqual([]);
  });

  // profile_summaries: korisnik vidi sebe i tim podrške, ali ne druge korisnike
  // i ne vidi email ni u jednom redu.
  it("profile_summaries skriva druge korisnike i emailove", async () => {
    const ana = await as("ana");
    const rows = await expectDbOk(ana.from("profile_summaries").select("*"));
    const ids = rows.map((row) => row.id);
    expect(ids).toContain(USERS.ana.id);
    expect(ids).toContain(USERS.agent.id);
    expect(ids).not.toContain(USERS.marko.id);
    expect(Object.keys(rows[0] ?? {})).not.toContain("email");
  });

  // Triger handle_new_user: nalog iz Google-a (ime u `name`, slika u
  // `avatar_url`) dobija profil sa ulogom customer.
  it("novi nalog dobija profil customer (Google metapodaci)", async () => {
    const email = `google-${randomUUID()}@helpdesk.test`;
    const service = serviceClient();
    const { data, error } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: "Google Korisnik", avatar_url: "https://example.com/a.png" },
    });
    expect(error).toBeNull();
    const profile = await expectDbOk(
      service
        .from("profiles")
        .select("full_name, avatar_url, role, locale")
        .eq("id", data.user!.id)
        .single(),
    );
    expect(profile).toEqual({
      full_name: "Google Korisnik",
      avatar_url: "https://example.com/a.png",
      role: "customer",
      locale: "sr",
    });
    await service.auth.admin.deleteUser(data.user!.id);
  });
});

describe("categories", () => {
  // Svaki prijavljen korisnik vidi aktivne kategorije (5 iz seed-a).
  it("korisnik vidi aktivne kategorije", async () => {
    const ana = await as("ana");
    const rows = await expectDbOk(ana.from("categories").select("slug").eq("is_active", true));
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  // Samo admin dodaje i menja kategorije.
  it("korisnik i agent ne dodaju kategorije, admin dodaje", async () => {
    const slug = `test-${Date.now()}`;
    const row = { slug, name_sr: "Test kategorija", name_en: "Test category" };

    for (const user of ["ana", "agent"] as const) {
      const client = await as(user);
      const { error } = await client.from("categories").insert(row);
      expect(error?.code).toBe("42501");
    }

    const admin = await as("admin");
    const created = await expectDbOk(admin.from("categories").insert(row).select("id").single());

    // Deaktivirana kategorija: korisnik je više ne vidi, admin je vidi.
    await expectDbOk(admin.from("categories").update({ is_active: false }).eq("id", created.id));
    const ana = await as("ana");
    expect(await expectDbOk(ana.from("categories").select("id").eq("id", created.id))).toEqual([]);
    expect(
      await expectDbOk(admin.from("categories").select("id").eq("id", created.id)),
    ).toHaveLength(1);
  });

  // Kategorija se ne briše (DELETE nije dozvoljen ni adminu).
  it("niko ne briše kategorije", async () => {
    const admin = await as("admin");
    const { error } = await admin.from("categories").delete().eq("slug", "other");
    expect(error?.code).toBe("42501");
  });
});
