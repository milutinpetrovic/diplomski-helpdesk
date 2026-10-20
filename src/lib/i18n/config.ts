/**
 * Fajl: src/lib/i18n/config.ts
 * Svrha: jedno mesto sa podešavanjima višejezičnosti (koji jezici postoje,
 * koji je podrazumevani i kako se zove kolačić u kome se pamti izbor).
 * Koriste ga: src/lib/i18n/request.ts (server) i LanguageSwitcher (klijent).
 * Povezano sa: messages/en.json i messages/sr.json (prevodi za svaki jezik).
 */

/** Lista podržanih jezika. Redosled određuje redosled dugmadi u LanguageSwitcher-u. */
export const locales = ["sr", "en"] as const;

/** Tip jezika izveden iz liste iznad: "sr" | "en". */
export type Locale = (typeof locales)[number];

/** Jezik koji se koristi kada korisnik još nije izabrao jezik (srpski, latinica). */
export const defaultLocale: Locale = "sr";

/** Naziv kolačića u kome se pamti izabrani jezik (isti naziv koristi next-intl). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Koliko dugo se pamti izbor jezika: jedna godina, izraženo u sekundama. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Proverava da li je prosleđena vrednost podržan jezik.
 * Ulaz: bilo koji tekst (npr. vrednost kolačića, koja može biti izmenjena ručno).
 * Vraća: true ako je jezik podržan; TypeScript tada zna da je vrednost tipa Locale.
 */
export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}
