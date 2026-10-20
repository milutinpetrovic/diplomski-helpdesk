/**
 * Fajl: src/services/auth/auth-errors.ts
 * Svrha: prevodi greške Supabase Auth servisa (npr. "invalid_credentials",
 * "email_not_confirmed") u kodove grešaka aplikacije (AppError), da bi
 * interfejs mogao da prikaže prevedenu poruku.
 * Koristi ga: AuthService (src/services/auth/auth-service.ts).
 * Povezano sa: src/lib/errors/codes.ts, messages/*.json (errors i validation),
 * spisak kodova Supabase Auth-a: https://supabase.com/docs/guides/auth/debugging/error-codes
 */
import { AppError } from "@/lib/errors/app-error";
import { VALIDATION_KEYS } from "@/lib/validation/auth";

/** Oblik greške iz Supabase Auth-a (AuthError ima code i status). */
export interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

/**
 * Pretvara grešku Supabase Auth-a u AppError.
 * Ulaz: greška iz supabase.auth.* poziva.
 * Vraća: AppError sa našim kodom; nepoznata greška postaje INTERNAL_ERROR
 * (original ostaje kao uzrok za log servera).
 */
export function mapAuthError(error: AuthErrorLike): AppError {
  const cause = { cause: error };
  switch (error.code) {
    // Pogrešan email ili lozinka.
    case "invalid_credentials":
      return new AppError("INVALID_CREDENTIALS", undefined, cause);
    // Korisnik još nije kliknuo na link iz emaila.
    case "email_not_confirmed":
      return new AppError("EMAIL_NOT_CONFIRMED", undefined, cause);
    // Nalog sa tim emailom već postoji.
    case "user_already_exists":
    case "email_exists":
      return new AppError("EMAIL_ALREADY_REGISTERED", undefined, cause);
    // Lozinka ne ispunjava pravila Supabase-a (dodatna provera pored naše Zod šeme).
    case "weak_password":
      return fieldError("password", VALIDATION_KEYS.passwordWeak, error);
    // Nova lozinka je ista kao stara.
    case "same_password":
      return fieldError("password", VALIDATION_KEYS.passwordSame, error);
    // Supabase ne prihvata ovaj email (npr. nepostojeći domen).
    case "email_address_invalid":
      return fieldError("email", VALIDATION_KEYS.emailInvalid, error);
    // Previše pokušaja ili poslatih emailova u kratkom roku.
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return new AppError("RATE_LIMITED", undefined, cause);
    // Nalog je blokiran u Supabase Auth-u.
    case "user_banned":
      return new AppError("ACCOUNT_DISABLED", undefined, cause);
    // Sesija ne postoji ili je istekla.
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return new AppError("UNAUTHENTICATED", undefined, cause);
    default:
      // supabase-js baca AuthSessionMissingError (bez koda) kad sesije nema.
      if (error.message?.toLowerCase().includes("session missing")) {
        return new AppError("UNAUTHENTICATED", undefined, cause);
      }
      return new AppError("INTERNAL_ERROR", undefined, cause);
  }
}

/** VALIDATION_ERROR sa greškom za jedno polje (isti oblik kao Zod greške u withApi). */
function fieldError(field: string, key: string, error: AuthErrorLike): AppError {
  return new AppError("VALIDATION_ERROR", { fields: { [field]: [key] } }, { cause: error });
}
