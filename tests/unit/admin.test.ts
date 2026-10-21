/**
 * Unit testovi: administracija naloga i kategorija (Faza 8b), bez baze.
 *   - Zod šeme: izmena naloga, lista naloga, nova i izmenjena kategorija
 *     (poruke grešaka su ključevi prevoda validation.<ključ>)
 *   - sanitizeUserSearch: pretraga ne može da promeni PostgREST filter
 *   - ticketsFreedBy / needsConfirmation: kada stranica traži potvrdu
 *   - user-list-params: filteri liste naloga u adresi
 */
import { describe, expect, it } from "vitest";

import { needsConfirmation, ticketsFreedBy } from "@/components/admin/user-change";
import {
  hasActiveUserFilters,
  parseUserListParams,
  userListHref,
} from "@/components/admin/user-list-params";
import { adminUpdateUserSchema, userListQuerySchema } from "@/lib/validation/admin";
import { createCategorySchema, updateCategorySchema } from "@/lib/validation/categories";
import { sanitizeUserSearch } from "@/services/admin/user-admin-service";

/** Prva poruka greške za polje (ključ prevoda) ili undefined. */
function firstError(
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  field: string,
) {
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("adminUpdateUserSchema", () => {
  it("prihvata ulogu i/ili aktivnost, odbija prazno telo i nepoznata polja", () => {
    expect(adminUpdateUserSchema.parse({ role: "agent" })).toEqual({ role: "agent" });
    expect(adminUpdateUserSchema.parse({ isActive: false })).toEqual({ isActive: false });
    expect(adminUpdateUserSchema.safeParse({}).success).toBe(false);
    expect(adminUpdateUserSchema.safeParse({ role: "superadmin" }).success).toBe(false);
    expect(adminUpdateUserSchema.safeParse({ role: "agent", email: "x@y.z" }).success).toBe(false);
  });
});

describe("userListQuerySchema", () => {
  it("podrazumevano strana 1 i 20 po strani; filteri su opcioni", () => {
    expect(userListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(
      userListQuerySchema.parse({ q: "  jelena ", role: "agent", isActive: "false" }),
    ).toMatchObject({
      q: "jelena",
      role: "agent",
      isActive: "false",
    });
    expect(userListQuerySchema.safeParse({ isActive: "da" }).success).toBe(false);
  });
});

describe("createCategorySchema / updateCategorySchema", () => {
  const valid = { slug: "network", nameEn: "Network", nameSr: "Mreža" };

  it("ispravna kategorija: prazan opis postaje null, redosled iz teksta postaje broj", () => {
    expect(
      createCategorySchema.parse({
        ...valid,
        descriptionSr: "  ",
        descriptionEn: "VPN",
        sortOrder: "6",
      }),
    ).toEqual({ ...valid, descriptionSr: null, descriptionEn: "VPN", sortOrder: 6 });
    // Bez redosleda: 0.
    expect(createCategorySchema.parse(valid).sortOrder).toBe(0);
  });

  it("greške su ključevi prevoda", () => {
    const result = createCategorySchema.safeParse({
      slug: "Mreža VPN",
      nameEn: "N",
      nameSr: "x".repeat(61),
      descriptionEn: "x".repeat(301),
      sortOrder: 1001,
    });
    expect(firstError(result, "slug")).toBe("slugFormat");
    expect(firstError(result, "nameEn")).toBe("categoryNameLength");
    expect(firstError(result, "nameSr")).toBe("categoryNameLength");
    expect(firstError(result, "descriptionEn")).toBe("categoryDescriptionLength");
    expect(firstError(result, "sortOrder")).toBe("sortOrderRange");
    // Oznaka: bez crtice na početku/kraju i bez dve crtice zaredom.
    for (const slug of ["-net", "net-", "net--work", "NET"]) {
      expect(createCategorySchema.safeParse({ ...valid, slug }).success).toBe(false);
    }
    expect(createCategorySchema.safeParse({ ...valid, slug: "wi-fi-2" }).success).toBe(true);
  });

  it("izmena: bar jedno polje, bez nepoznatih polja", () => {
    expect(updateCategorySchema.parse({ isActive: false })).toEqual({ isActive: false });
    expect(updateCategorySchema.safeParse({}).success).toBe(false);
    expect(updateCategorySchema.safeParse({ id: "x" }).success).toBe(false);
  });
});

describe("sanitizeUserSearch", () => {
  it("uklanja znakove sa posebnim značenjem u PostgREST filteru", () => {
    expect(sanitizeUserSearch("jelena")).toBe("jelena");
    expect(sanitizeUserSearch("a,role.eq.admin")).toBe("a role.eq.admin");
    expect(sanitizeUserSearch('x*)(%"\\')).toBe("x");
    expect(sanitizeUserSearch(" ,() ")).toBe("");
  });
});

describe("ticketsFreedBy / needsConfirmation", () => {
  const agent = { role: "agent" as const, isActive: true, openAssignedCount: 3 };

  it("zahtevi se vraćaju u red kad član tima postane korisnik ili se deaktivira", () => {
    expect(ticketsFreedBy(agent, { role: "customer" })).toBe(3);
    expect(ticketsFreedBy(agent, { isActive: false })).toBe(3);
    expect(ticketsFreedBy({ ...agent, role: "admin" }, { role: "customer" })).toBe(3);
    // Agent -> admin ostaje u timu; korisnik nema dodeljene zahteve.
    expect(ticketsFreedBy(agent, { role: "admin" })).toBe(0);
    expect(ticketsFreedBy({ ...agent, role: "customer" }, { isActive: false })).toBe(0);
  });

  it("potvrda: uvek za deaktivaciju, za ulogu samo kad se zahtevi vraćaju u red", () => {
    expect(needsConfirmation(agent, { role: "customer" })).toBe(true);
    expect(needsConfirmation({ ...agent, openAssignedCount: 0 }, { role: "customer" })).toBe(false);
    expect(
      needsConfirmation({ ...agent, role: "customer", openAssignedCount: 0 }, { isActive: false }),
    ).toBe(true);
    expect(needsConfirmation(agent, { isActive: true })).toBe(false);
    expect(needsConfirmation(agent, { role: "admin" })).toBe(false);
  });
});

describe("user-list-params", () => {
  it("adresa -> filteri, neispravni parametri se zanemaruju", () => {
    expect(parseUserListParams({ q: "ana", role: "xyz", isActive: "", page: "2" })).toEqual({
      q: "ana",
      page: 2,
      pageSize: 20,
    });
    expect(parseUserListParams({ role: ["agent", "admin"] }).role).toBe("agent");
  });

  it("filteri -> adresa bez podrazumevanih vrednosti", () => {
    expect(userListHref({ page: 1, pageSize: 20 })).toBe("/admin/users");
    expect(userListHref({ page: 1, pageSize: 20, role: "agent" }, { page: 3 })).toBe(
      "/admin/users?role=agent&page=3",
    );
    expect(hasActiveUserFilters({ page: 1, pageSize: 20 })).toBe(false);
    expect(hasActiveUserFilters({ page: 1, pageSize: 20, isActive: "true" })).toBe(true);
  });
});
