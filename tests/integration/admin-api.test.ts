/**
 * Integracioni testovi: API administracije (Faza 8b, UC-21, UC-22) nad pravim
 * lokalnim Supabase-om:
 *   - GET /api/admin/users, PATCH /api/admin/users/{id}
 *   - POST /api/admin/categories, PATCH /api/admin/categories/{id}
 *
 * Kriterijumi iz docs/07 (Faza 8):
 *   - agent i korisnik dobijaju 403 na svakoj ruti /api/admin/*
 *   - admin ne može sebi da menja ulogu (409 CANNOT_MODIFY_SELF)
 *   - oduzimanje uloge agentu vraća njegove zahteve u red, sa istorijom
 *   - deaktiviran nalog dobija 403 ACCOUNT_DISABLED na svakom pozivu
 *   - nova i izmenjena kategorija se vidi u spisku za „Novi zahtev“, a deaktivirana nestaje
 * Privremeni nalog i kategorija se prave u testu i brišu posle, da demo
 * podaci ostanu nepromenjeni za ostale testove.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PATCH as patchCategory } from "@/app/api/admin/categories/[id]/route";
import { POST as postCategory } from "@/app/api/admin/categories/route";
import { PATCH as patchUser } from "@/app/api/admin/users/[id]/route";
import { GET as getUsers } from "@/app/api/admin/users/route";
import { GET as getCategories } from "@/app/api/categories/route";
import type { RouteHandler } from "@/lib/api/with-api";
import { adminUserListSchema, adminUserSchema } from "@/lib/validation/admin";
import { categorySchema } from "@/lib/validation/categories";
import { as, createTicket, serviceClient, signInAs, USERS, type SeedUser } from "./helpers";

/** Lozinka privremenog naloga. */
const TEMP_PASSWORD = "Privremena123!";

/** Pristupni tokeni (demo nalozi i privremeni nalog „temp“). */
const tokens: Record<string, string> = {};

/** Privremeni nalog (pravi ga service_role u beforeAll). */
let temp: { id: string; email: string };

/** ID-jevi privremenih kategorija (brišu se posle testova). */
const createdCategoryIds: string[] = [];

/** Jedinstvena oznaka kategorije za ovo pokretanje testa. */
const SLUG = `test-${randomUUID().slice(0, 8)}`;

/** Pristupni token za prijavljen klijent. */
async function tokenOf(client: Awaited<ReturnType<typeof as>>): Promise<string> {
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error("Nema sesije");
  return data.session.access_token;
}

beforeAll(async () => {
  // Korak 1: prijava demo naloga koji pozivaju rute.
  for (const user of ["ana", "agent", "admin"] as const)
    tokens[user] = await tokenOf(await as(user));

  // Korak 2: privremeni nalog (uloga customer) i njegova prijava.
  const email = `temp-admin-api-${randomUUID()}@helpdesk.test`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Privremeni Agent" },
  });
  if (error || !data.user) throw new Error(`Nalog nije napravljen: ${error?.message}`);
  temp = { id: data.user.id, email };
  tokens.temp = await tokenOf(await signInAs(email, TEMP_PASSWORD));
});

afterAll(async () => {
  // Brisanje privremenog naloga (profil kaskadno) i kategorija.
  if (temp) await serviceClient().auth.admin.deleteUser(temp.id);
  if (createdCategoryIds.length > 0) {
    await serviceClient().from("categories").delete().in("id", createdCategoryIds);
  }
});

/**
 * Poziva rutu u ime naloga; vraća status i JSON telo.
 * Ulaz: ruta, nalog (ključ u tokens), metod, parametri putanje, query i telo.
 */
async function call(
  route: RouteHandler,
  user: SeedUser | "temp",
  options: {
    method?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  const url = new URL("http://localhost/api/test");
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  const headers: Record<string, string> = { Authorization: `Bearer ${tokens[user]}` };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const request = new Request(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const response = await route(request, { params: Promise.resolve(options.params ?? {}) });
  const text = await response.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- telo odgovora se proverava u testu
  const json: any = text ? JSON.parse(text) : undefined;
  return { status: response.status, json };
}

describe("API administracije: pristup", () => {
  // Svaka ruta /api/admin/* je samo za admina (proverava withApi, servis i RLS/RPC).
  it("agent i korisnik dobijaju 403 na svim rutama /api/admin/*", async () => {
    const someId = { id: USERS.marko.id };
    const categoryId = { id: "10000000-0000-4000-8000-000000000001" };
    for (const user of ["agent", "ana"] as const) {
      const results = await Promise.all([
        call(getUsers, user),
        call(patchUser, user, { method: "PATCH", params: someId, body: { role: "agent" } }),
        call(postCategory, user, {
          method: "POST",
          body: { slug: "zabranjeno", nameEn: "Forbidden", nameSr: "Zabranjeno" },
        }),
        call(patchCategory, user, {
          method: "PATCH",
          params: categoryId,
          body: { isActive: false },
        }),
      ]);
      for (const { status, json } of results) {
        expect(status).toBe(403);
        expect(json.error.code).toBe("FORBIDDEN");
      }
    }
  });
});

describe("API administracije: nalozi", () => {
  // Lista: oblik, pretraga po imenu/emailu, filteri uloge i aktivnosti, paginacija.
  it("lista naloga sa pretragom, filterima i paginacijom", async () => {
    const all = await call(getUsers, "admin");
    expect(all.status).toBe(200);
    expect(adminUserListSchema.safeParse(all.json).success).toBe(true);
    expect(all.json.total).toBeGreaterThanOrEqual(5);

    // Pretraga po imenu (bez obzira na velika slova) i po emailu.
    const byName = await call(getUsers, "admin", { query: { q: "JELENA" } });
    expect(byName.json.items.map((user: { id: string }) => user.id)).toContain(USERS.agent.id);
    const byEmail = await call(getUsers, "admin", { query: { q: "agent2@" } });
    expect(byEmail.json.items).toHaveLength(1);
    expect(byEmail.json.items[0].id).toBe(USERS.agent2.id);

    // Filter uloge: samo agenti, svaki sa brojem nerešenih dodeljenih zahteva.
    const agents = await call(getUsers, "admin", { query: { role: "agent" } });
    expect(agents.json.items.length).toBeGreaterThanOrEqual(2);
    for (const user of agents.json.items) {
      expect(user.role).toBe("agent");
      expect(user.openAssignedCount).toBeGreaterThanOrEqual(0);
    }

    // Filter aktivnosti i paginacija (2 po strani).
    const inactive = await call(getUsers, "admin", { query: { isActive: "false" } });
    expect(inactive.json.items.every((user: { isActive: boolean }) => !user.isActive)).toBe(true);
    const page2 = await call(getUsers, "admin", { query: { page: "2", pageSize: "2" } });
    expect(page2.json).toMatchObject({ page: 2, pageSize: 2, total: all.json.total });
    expect(page2.json.items).toHaveLength(2);

    // Neispravan filter: 400 VALIDATION_ERROR.
    const invalid = await call(getUsers, "admin", { query: { role: "superadmin" } });
    expect(invalid.status).toBe(400);
    expect(invalid.json.error.code).toBe("VALIDATION_ERROR");
  });

  // Admin ne menja sebe (da ne bi slučajno ostao bez admin prava).
  it("admin ne može sebi da menja ulogu ni aktivnost (409)", async () => {
    for (const body of [{ role: "agent" }, { isActive: false }]) {
      const { status, json } = await call(patchUser, "admin", {
        method: "PATCH",
        params: { id: USERS.admin.id },
        body,
      });
      expect(status).toBe(409);
      expect(json.error.code).toBe("CANNOT_MODIFY_SELF");
    }
  });

  // Prazno telo i nepostojeći nalog.
  it("prazna izmena je 400, nepostojeći nalog 404", async () => {
    const empty = await call(patchUser, "admin", {
      method: "PATCH",
      params: { id: USERS.marko.id },
      body: {},
    });
    expect(empty.status).toBe(400);
    const missing = await call(patchUser, "admin", {
      method: "PATCH",
      params: { id: randomUUID() },
      body: { role: "agent" },
    });
    expect(missing.status).toBe(404);
    expect(missing.json.error.code).toBe("NOT_FOUND");
  });

  // Ceo tok: unapređenje u agenta, dodela zahteva, oduzimanje uloge, deaktivacija.
  it("oduzimanje uloge vraća zahteve u red (sa istorijom); deaktiviran nalog dobija 403", async () => {
    // Korak 1: privremeni korisnik postaje agent.
    const promoted = await call(patchUser, "admin", {
      method: "PATCH",
      params: { id: temp.id },
      body: { role: "agent" },
    });
    expect(promoted.status).toBe(200);
    expect(adminUserSchema.safeParse(promoted.json).success).toBe(true);
    expect(promoted.json).toMatchObject({ role: "agent", isActive: true, openAssignedCount: 0 });

    // Korak 2: admin mu dodeljuje zahtev (dodela prebacuje zahtev u in_progress).
    const ticket = await createTicket("ana");
    const admin = await as("admin");
    const assigned = await admin.rpc("assign_ticket", {
      p_ticket_id: ticket.id,
      p_assignee_id: temp.id,
    });
    expect(assigned.error).toBeNull();
    const listed = await call(getUsers, "admin", { query: { q: temp.email } });
    expect(listed.json.items[0].openAssignedCount).toBe(1);

    // Korak 3: oduzimanje uloge -> zahtev je ponovo otvoren i nedodeljen.
    const demoted = await call(patchUser, "admin", {
      method: "PATCH",
      params: { id: temp.id },
      body: { role: "customer" },
    });
    expect(demoted.status).toBe(200);
    expect(demoted.json).toMatchObject({ role: "customer", openAssignedCount: 0 });
    const { data: after } = await serviceClient()
      .from("tickets")
      .select("status, assigned_to")
      .eq("id", ticket.id)
      .single();
    expect(after).toEqual({ status: "open", assigned_to: null });

    // Istorija: zapis o oslobađanju (ko je to uradio i čiji je zahtev bio).
    const { data: history } = await serviceClient()
      .from("ticket_history")
      .select("action, actor_id, old_value")
      .eq("ticket_id", ticket.id)
      .eq("action", "unassigned");
    expect(history).toEqual([
      { action: "unassigned", actor_id: USERS.admin.id, old_value: { assigned_to: temp.id } },
    ]);

    // Korak 4: deaktivacija -> svaki poziv tog naloga dobija 403 ACCOUNT_DISABLED.
    const deactivated = await call(patchUser, "admin", {
      method: "PATCH",
      params: { id: temp.id },
      body: { isActive: false },
    });
    expect(deactivated.status).toBe(200);
    expect(deactivated.json.isActive).toBe(false);
    const blocked = await call(getCategories, "temp");
    expect(blocked.status).toBe(403);
    expect(blocked.json.error.code).toBe("ACCOUNT_DISABLED");

    // Korak 5: ponovna aktivacija vraća pristup.
    await call(patchUser, "admin", {
      method: "PATCH",
      params: { id: temp.id },
      body: { isActive: true },
    });
    expect((await call(getCategories, "temp")).status).toBe(200);
  });
});

describe("API administracije: kategorije", () => {
  /** Da li je kategorija u spisku koji korisnik vidi u formi „Novi zahtev“. */
  async function visibleToCustomer(id: string): Promise<boolean> {
    const { json } = await call(getCategories, "ana");
    return json.some((category: { id: string }) => category.id === id);
  }

  // Dodavanje, izmena, deaktivacija i ponovna aktivacija.
  it("nova, izmenjena i deaktivirana kategorija", async () => {
    // Korak 1: nova kategorija (201), odmah vidljiva korisniku.
    const created = await call(postCategory, "admin", {
      method: "POST",
      body: {
        slug: SLUG,
        nameEn: "Test network",
        nameSr: "Test mreža",
        descriptionSr: "",
        sortOrder: 50,
      },
    });
    expect(created.status).toBe(201);
    expect(categorySchema.safeParse(created.json).success).toBe(true);
    createdCategoryIds.push(created.json.id);
    // Prazan opis se čuva kao null, a neposlat opis isto.
    expect(created.json).toMatchObject({
      slug: SLUG,
      nameSr: "Test mreža",
      descriptionSr: null,
      descriptionEn: null,
      isActive: true,
      sortOrder: 50,
    });
    expect(await visibleToCustomer(created.json.id)).toBe(true);

    // Korak 2: izmena naziva.
    const renamed = await call(patchCategory, "admin", {
      method: "PATCH",
      params: { id: created.json.id },
      body: { nameSr: "Mreža i VPN" },
    });
    expect(renamed.status).toBe(200);
    expect(renamed.json).toMatchObject({ nameSr: "Mreža i VPN", nameEn: "Test network" });
    const { json: list } = await call(getCategories, "ana");
    expect(list.find((c: { id: string }) => c.id === created.json.id).nameSr).toBe("Mreža i VPN");

    // Korak 3: deaktivacija -> nestaje iz spiska za korisnika, ali je admin i dalje vidi.
    const off = await call(patchCategory, "admin", {
      method: "PATCH",
      params: { id: created.json.id },
      body: { isActive: false },
    });
    expect(off.json.isActive).toBe(false);
    expect(await visibleToCustomer(created.json.id)).toBe(false);
    const { json: adminList } = await call(getCategories, "admin", {
      query: { includeInactive: "true" },
    });
    expect(adminList.some((c: { id: string }) => c.id === created.json.id)).toBe(true);

    // Korak 4: ponovna aktivacija.
    await call(patchCategory, "admin", {
      method: "PATCH",
      params: { id: created.json.id },
      body: { isActive: true },
    });
    expect(await visibleToCustomer(created.json.id)).toBe(true);
  });

  // Ista oznaka: 409 i pri dodavanju i pri izmeni druge kategorije.
  it("zauzeta oznaka daje 409 CATEGORY_SLUG_TAKEN", async () => {
    const duplicate = await call(postCategory, "admin", {
      method: "POST",
      body: { slug: "technical", nameEn: "Duplicate", nameSr: "Duplikat" },
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.json.error.code).toBe("CATEGORY_SLUG_TAKEN");

    const renamed = await call(patchCategory, "admin", {
      method: "PATCH",
      params: { id: "10000000-0000-4000-8000-000000000002" },
      body: { slug: "technical" },
    });
    expect(renamed.status).toBe(409);
    expect(renamed.json.error.code).toBe("CATEGORY_SLUG_TAKEN");
  });

  // Neispravni podaci (greške po poljima, ključevi prevoda) i nepostojeća kategorija.
  it("neispravna forma je 400 sa greškama po poljima, nepostojeća kategorija 404", async () => {
    const invalid = await call(postCategory, "admin", {
      method: "POST",
      body: { slug: "Loša Oznaka", nameEn: "X", nameSr: "Ispravno", sortOrder: 5000 },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.json.error.details.fields).toMatchObject({
      slug: ["slugFormat"],
      nameEn: ["categoryNameLength"],
      sortOrder: ["sortOrderRange"],
    });

    const missing = await call(patchCategory, "admin", {
      method: "PATCH",
      params: { id: randomUUID() },
      body: { isActive: false },
    });
    expect(missing.status).toBe(404);
  });
});
