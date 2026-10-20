/**
 * Fajl: src/lib/errors/codes.ts
 * Svrha: spisak svih kodova grešaka u aplikaciji i HTTP status koji svaki
 * kod vraća iz API-ja.
 * Koriste ga: AppError (server), ApiErrorHandler, ApiClient (klijent) i
 * prevodi u messages/*.json (ključ errors.<KOD>).
 * Povezano sa: docs/06-api-i-stranice.md, sekcija 1 (tabela grešaka) i SQL
 * funkcijama u supabase/migrations, koje vraćaju iste kodove
 * (raise exception using message = '<KOD>').
 */

/**
 * Kod greške -> HTTP status. Kodovi su stabilni (ne menjaju se), jer ih
 * interfejs prevodi, a Swagger i Postman ih prikazuju.
 */
export const ERROR_HTTP_STATUS = {
  // 400: neispravan ulaz
  VALIDATION_ERROR: 400,
  AUTH_CALLBACK_FAILED: 400,
  // 401: nema sesije ili pogrešni podaci za prijavu
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  // 403: nema prava
  FORBIDDEN: 403,
  ACCOUNT_DISABLED: 403,
  NOT_ASSIGNED_AGENT: 403,
  FORBIDDEN_INTERNAL_COMMENT: 403,
  EMAIL_NOT_CONFIRMED: 403,
  // 404: ne postoji ili korisnik nema pravo da ga vidi
  NOT_FOUND: 404,
  TICKET_NOT_FOUND: 404,
  // 409: konflikt sa trenutnim stanjem
  INVALID_STATUS_TRANSITION: 409,
  TICKET_ALREADY_ASSIGNED: 409,
  ASSIGNEE_NOT_AGENT: 409,
  TICKET_CLOSED: 409,
  ALREADY_RATED: 409,
  TICKET_NOT_RESOLVED: 409,
  EMAIL_ALREADY_REGISTERED: 409,
  CANNOT_MODIFY_SELF: 409,
  // 429: previše zahteva (Faza A)
  RATE_LIMITED: 429,
  // 500: neočekivana greška
  INTERNAL_ERROR: 500,
} as const;

/** Kod greške: "TICKET_NOT_FOUND" | "FORBIDDEN" | ... */
export type ErrorCode = keyof typeof ERROR_HTTP_STATUS;

/** Svi kodovi kao niz (za Zod/OpenAPI enum i testove). */
export const ERROR_CODES = Object.keys(ERROR_HTTP_STATUS) as [ErrorCode, ...ErrorCode[]];

/**
 * Proverava da li je tekst poznat kod greške.
 * Ulaz: bilo koji tekst (npr. poruka greške iz baze).
 * Vraća: true ako je kod poznat; TypeScript tada zna da je vrednost ErrorCode.
 */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.hasOwn(ERROR_HTTP_STATUS, value);
}

/** Vraća HTTP status za dati kod greške. */
export function httpStatusFor(code: ErrorCode): number {
  return ERROR_HTTP_STATUS[code];
}
