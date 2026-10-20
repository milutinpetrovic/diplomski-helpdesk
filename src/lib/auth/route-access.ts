/**
 * Fajl: src/lib/auth/route-access.ts
 * Svrha: pravila preusmerenja stranica po tome da li je korisnik prijavljen
 * (docs/06-api-i-stranice.md, sekcija 4, „Zaštita stranica“):
 *   - gost na zaštićenoj stranici -> /login?next=<ta stranica>
 *   - prijavljen korisnik na /login, /register, /forgot-password ili / -> /dashboard
 *   - /reset-password bez sesije (link nije otvoren ili je istekao) -> /forgot-password
 * Ovde se NE proverava uloga: to rade serverski layout-i (/admin, /analytics) i API.
 * Koristi ga: src/proxy.ts. Odvojeno je u čistu funkciju da bi se lako testiralo.
 */
import { safeNextPath } from "@/lib/validation/auth";

/** Početak putanja zaštićenog dela (src/app/(app)/). */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/tickets",
  "/notifications",
  "/profile",
  "/analytics",
  "/admin",
] as const;

/** Stranice samo za goste (src/app/(auth)/, bez /reset-password). */
export const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"] as const;

/** Da li putanja pripada nekom od prefiksa (npr. /admin/users pripada /admin). */
function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Određuje da li stranicu treba preusmeriti.
 * Ulaz: adresa zahteva i da li je korisnik prijavljen.
 * Vraća: putanju (sa query delom) na koju se preusmerava, ili null ako se stranica prikazuje.
 */
export function getAccessRedirect(url: URL, isLoggedIn: boolean): string | null {
  const { pathname, search, searchParams } = url;

  // Gost: zaštićene stranice traže prijavu; posle prijave vraća se na istu stranicu.
  if (!isLoggedIn) {
    if (matches(pathname, PROTECTED_PREFIXES)) {
      return `/login?next=${encodeURIComponent(pathname + search)}`;
    }
    if (pathname === "/reset-password") return "/forgot-password";
    return null;
  }

  // Prijavljen: početna i stranice za goste vode na kontrolni panel (ili na ?next).
  // Izuzetak: /login?error=... ostaje, da bi se videla poruka (npr. deaktiviran nalog).
  if (pathname === "/") return "/dashboard";
  if (matches(pathname, GUEST_ONLY_PATHS) && !searchParams.has("error")) {
    return safeNextPath(searchParams.get("next"));
  }
  return null;
}
