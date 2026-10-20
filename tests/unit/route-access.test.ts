/**
 * Unit testovi: zaštita stranica (src/lib/auth/route-access.ts, koristi ga proxy.ts)
 * i meni po ulozi (src/components/layout/nav-items.ts).
 *
 * Proverava tabelu iz docs/06 (sekcija 4): gost ne može na zaštićene stranice,
 * prijavljen korisnik ne vidi stranice za prijavu, a meni prikazuje stavke po ulozi.
 * Proveru uloge za /admin i /analytics rade serverski layout-i (vidi README, testiranje).
 */
import { describe, expect, it } from "vitest";

import { getNavItems, isNavItemActive } from "@/components/layout/nav-items";
import { getAccessRedirect } from "@/lib/auth/route-access";

/** Skraćenica: preusmerenje za putanju (sa query delom). */
function redirectFor(pathAndQuery: string, isLoggedIn: boolean) {
  return getAccessRedirect(new URL(pathAndQuery, "http://localhost:3000"), isLoggedIn);
}

describe("gost (nije prijavljen)", () => {
  it.each(["/dashboard", "/profile", "/admin/users", "/analytics", "/tickets/5"])(
    "%s -> /login sa povratkom na istu stranicu",
    (path) => {
      expect(redirectFor(path, false)).toBe(`/login?next=${encodeURIComponent(path)}`);
    },
  );

  it("čuva i query deo adrese", () => {
    expect(redirectFor("/tickets?status=open", false)).toBe(
      `/login?next=${encodeURIComponent("/tickets?status=open")}`,
    );
  });

  it.each(["/", "/login", "/register", "/forgot-password", "/api-docs"])(
    "%s je dostupna",
    (path) => {
      expect(redirectFor(path, false)).toBeNull();
    },
  );

  it("/reset-password bez sesije vodi na /forgot-password", () => {
    expect(redirectFor("/reset-password", false)).toBe("/forgot-password");
  });

  it("putanja koja samo počinje istim slovima nije zaštićena (/administracija-test)", () => {
    expect(redirectFor("/administracija-test", false)).toBeNull();
  });
});

describe("prijavljen korisnik", () => {
  it.each(["/", "/login", "/register", "/forgot-password"])("%s -> /dashboard", (path) => {
    expect(redirectFor(path, true)).toBe("/dashboard");
  });

  it("/login?next=/profile vodi na /profile", () => {
    expect(redirectFor("/login?next=%2Fprofile", true)).toBe("/profile");
  });

  it("/login?error=... ostaje (poruka o deaktiviranom nalogu)", () => {
    expect(redirectFor("/login?error=ACCOUNT_DISABLED", true)).toBeNull();
  });

  it.each(["/dashboard", "/profile", "/admin/users", "/reset-password"])(
    "%s je dostupna",
    (path) => {
      expect(redirectFor(path, true)).toBeNull();
    },
  );
});

describe("meni po ulozi", () => {
  it("korisnik vidi svoje zahteve i novi zahtev, bez admin stavki", () => {
    expect(getNavItems("customer").map((item) => item.key)).toEqual([
      "dashboard",
      "myTickets",
      "newTicket",
      "profile",
    ]);
  });

  it("agent vidi zahteve, bez novog zahteva i admin stavki", () => {
    expect(getNavItems("agent").map((item) => item.key)).toEqual([
      "dashboard",
      "tickets",
      "profile",
    ]);
  });

  it("admin vidi i analitiku, korisnike, kategorije i API dokumentaciju", () => {
    expect(getNavItems("admin").map((item) => item.key)).toEqual([
      "dashboard",
      "tickets",
      "analytics",
      "users",
      "categories",
      "apiDocs",
      "profile",
    ]);
  });

  it("stavka je aktivna i na podstranici", () => {
    expect(isNavItemActive("/admin/users", "/admin/users/5")).toBe(true);
    expect(isNavItemActive("/admin/users", "/admin/categories")).toBe(false);
  });

  it("na /tickets/new je aktivan samo „Novi zahtev“, na /tickets/5 „Moji zahtevi“", () => {
    const items = getNavItems("customer");
    expect(isNavItemActive("/tickets/new", "/tickets/new", items)).toBe(true);
    expect(isNavItemActive("/tickets", "/tickets/new", items)).toBe(false);
    expect(isNavItemActive("/tickets", "/tickets/5", items)).toBe(true);
    expect(isNavItemActive("/tickets", "/tickets", items)).toBe(true);
  });
});
