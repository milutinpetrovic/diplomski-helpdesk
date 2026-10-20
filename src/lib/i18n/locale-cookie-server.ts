/**
 * Fajl: src/lib/i18n/locale-cookie-server.ts
 * Svrha: čitanje i upis kolačića sa jezikom (NEXT_LOCALE) na SERVERU, u API rutama.
 * Koriste ga: rute za prijavu (POST /api/auth/login, GET /api/auth/callback):
 * pre prijave pročitaju jezik koji je korisnik izabrao, a posle prijave upišu
 * jezik iz profila, tako da korisnik uvek vidi interfejs na svom jeziku.
 * Povezano sa: config.ts (naziv kolačića), locale-cookie.ts (isto, ali u pregledaču).
 */
import { cookies } from "next/headers";

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "./config";

/** Vraća jezik iz kolačića, ili null ako korisnik jezik nije birao. */
export async function readLocaleCookie(): Promise<Locale | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : null;
}

/** Upisuje jezik u kolačić odgovora (isti oblik kao setLocaleCookie u pregledaču). */
export async function writeLocaleCookie(locale: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
