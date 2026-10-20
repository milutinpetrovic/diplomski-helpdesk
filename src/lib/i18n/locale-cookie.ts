/**
 * Fajl: src/lib/i18n/locale-cookie.ts
 * Svrha: upis izabranog jezika u kolačić u pregledaču.
 * Koristi ga: LanguageSwitcher (samo na klijentu, jer koristi document).
 * Odvojeno je u posebnu funkciju jer React pravila ne dozvoljavaju menjanje globalnih
 * objekata (kao što je document) direktno u telu komponente.
 */
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "./config";

/**
 * Upisuje jezik u kolačić NEXT_LOCALE koji važi za ceo sajt godinu dana.
 * Ulaz: izabrani jezik. Server ga čita u src/lib/i18n/request.ts pri sledećem zahtevu.
 */
export function setLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}
