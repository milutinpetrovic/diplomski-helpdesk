/**
 * Fajl: src/lib/i18n/request.ts
 * Svrha: za svaki zahtev na serveru određuje jezik i učitava odgovarajuće prevode.
 * Koristi ga: next-intl (putanja je zadata u next.config.ts preko createNextIntlPlugin).
 * Povezano sa: config.ts (podržani jezici i kolačić), messages/*.json (prevodi).
 *
 * Jezik se NE nalazi u URL-u (nema /sr/... i /en/...), već u kolačiću NEXT_LOCALE,
 * jer je aplikacija uglavnom iza prijave i URL-ovi treba da ostanu isti za oba jezika.
 */
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { APP_TIME_ZONE, defaultLocale, isLocale, LOCALE_COOKIE } from "./config";

/**
 * Konfiguracija za jedan zahtev.
 * Vraća: izabrani jezik, objekat sa svim prevodima za taj jezik i vremensku zonu.
 */
export default getRequestConfig(async () => {
  // Korak 1: pročitaj kolačić sa jezikom (ako ne postoji ili je neispravan, koristi srpski).
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieValue) ? cookieValue : defaultLocale;

  // Korak 2: učitaj samo fajl sa prevodima za izabrani jezik.
  const messages = (await import(`../../../messages/${locale}.json`)).default;

  // Korak 3: vremenska zona za prikaz datuma (npr. „20. okt 2026, 18:00“). Ista je na
  // serveru i u pregledaču, pa se datum iscrtan na serveru ne razlikuje od onog u pregledaču.
  return { locale, messages, timeZone: APP_TIME_ZONE };
});
