/**
 * Fajl: src/lib/analytics/period.ts
 * Svrha: rad sa periodom za analitiku (UC-23, FZ-15): današnji datum u zoni
 * aplikacije (Europe/Belgrade), podrazumevani period (poslednjih 30 dana),
 * brzi izbori (7, 30, 90, 180, 365 dana) i izbor prikaza trenda po danu ili
 * nedelji. Datumi su tekst oblika "2026-10-21" (bez vremena), isto kao u
 * adresi stranice (?from=&to=) i u parametrima RPC funkcija analytics_*.
 * Sve funkcije su čiste (bez baze), pa se lako testiraju.
 * Koriste ga: Zod šeme (src/lib/validation/analytics.ts), AnalyticsService,
 * stranica /analytics i komponenta AnalyticsFilters.
 * Povezano sa: supabase/migrations/..._analytics.sql (isto pravilo perioda).
 */
import { APP_TIME_ZONE } from "@/lib/i18n/config";

/** Najduži dozvoljeni period u danima (oba kraja uključena). */
export const MAX_RANGE_DAYS = 366;

/** Podrazumevani period: poslednjih 30 dana, uključujući danas. */
export const DEFAULT_RANGE_DAYS = 30;

/** Brzi izbori perioda na stranici (broj dana). */
export const RANGE_PRESETS = [7, 30, 90, 180, 365] as const;

/** Do koliko dana se trend prikazuje po danu; duži period ide po nedelji. */
export const DAILY_TREND_MAX_DAYS = 62;

/** Veličina intervala na grafikonu trenda. */
export const TREND_BUCKETS = ["day", "week"] as const;
export type TrendBucket = (typeof TREND_BUCKETS)[number];

/** Period sa oba kraja (datumi "YYYY-MM-DD", oba uključena). */
export interface DateRange {
  from: string;
  to: string;
}

/** Jedan dan u milisekundama. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Današnji datum u zoni aplikacije (Beograd), npr. "2026-10-21".
 * Ulaz: trenutak (podrazumevano sada) — test zadaje svoj.
 */
export function todayInAppZone(now: Date = new Date()): string {
  // Format en-CA daje baš oblik YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Datum pomeren za dati broj dana (može i negativno).
 * Računa se u UTC-u nad samim datumom, pa letnje računanje vremena ne utiče.
 */
export function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * DAY_MS;
  return new Date(time).toISOString().slice(0, 10);
}

/** Broj dana u periodu, sa oba kraja (isti dan = 1). */
export function rangeLength(range: DateRange): number {
  return Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY_MS) + 1;
}

/** Period od poslednjih N dana, zaključno sa danas. */
export function lastDays(days: number, today: string = todayInAppZone()): DateRange {
  return { from: addDays(today, -(days - 1)), to: today };
}

/**
 * Dopunjuje period koji nije ceo zadat:
 *   - ništa zadato: poslednjih 30 dana
 *   - samo "od": od tog dana do danas
 *   - samo "do": 30 dana zaključno sa tim danom
 */
export function resolveRange(
  input: Partial<DateRange>,
  today: string = todayInAppZone(),
): DateRange {
  const to = input.to ?? today;
  const from = input.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  return { from, to };
}

/**
 * Proverava period. Vraća ključ greške (validation.<ključ>) ili null ako je ispravan:
 *   - rangeOrder: "od" je posle "do"
 *   - rangeTooLong: duže od MAX_RANGE_DAYS dana
 */
export function rangeError(range: DateRange): "rangeOrder" | "rangeTooLong" | null {
  if (range.from > range.to) return "rangeOrder";
  if (rangeLength(range) > MAX_RANGE_DAYS) return "rangeTooLong";
  return null;
}

/** Prikaz trenda koji odgovara periodu: po danu do 62 dana, inače po nedelji. */
export function defaultBucket(range: DateRange): TrendBucket {
  return rangeLength(range) <= DAILY_TREND_MAX_DAYS ? "day" : "week";
}

/**
 * Koji brzi izbor odgovara periodu (da dugme bude označeno), ili null za
 * period koji je korisnik sam zadao.
 */
export function matchingPreset(
  range: DateRange,
  today: string = todayInAppZone(),
): (typeof RANGE_PRESETS)[number] | null {
  if (range.to !== today) return null;
  return RANGE_PRESETS.find((days) => lastDays(days, today).from === range.from) ?? null;
}
