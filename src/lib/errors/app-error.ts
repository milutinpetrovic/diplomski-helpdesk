/**
 * Fajl: src/lib/errors/app-error.ts
 * Svrha: klasa AppError, jedina vrsta greške koju servisi i API rute namerno
 * bacaju. Nosi stabilan kod (npr. TICKET_NOT_FOUND), HTTP status i opcione
 * detalje. Takođe prevodi greške iz Supabase-a u AppError.
 * Koriste je: servisi (src/services), AuthGuard, withApi, ApiErrorHandler.
 * Povezano sa: src/lib/errors/codes.ts (kodovi i statusi).
 */
import { httpStatusFor, isErrorCode, type ErrorCode } from "@/lib/errors/codes";

/** Dodatni podaci uz grešku, npr. { fields: { title: ["..."] } } za VALIDATION_ERROR. */
export type ErrorDetails = Record<string, unknown>;

/**
 * Greška aplikacije sa stabilnim kodom.
 * Primer: throw new AppError("TICKET_NOT_FOUND");
 */
export class AppError extends Error {
  /** Stabilan kod greške; interfejs ga prevodi (errors.<KOD>). */
  readonly code: ErrorCode;
  /** HTTP status koji API vraća za ovu grešku. */
  readonly httpStatus: number;
  /** Opcioni detalji (npr. greške po poljima). */
  readonly details?: ErrorDetails;

  /**
   * Ulaz: kod greške, opcioni detalji i opcioni uzrok (originalna greška,
   * samo za logove — nikad se ne šalje klijentu).
   */
  constructor(code: ErrorCode, details?: ErrorDetails, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatusFor(code);
    this.details = details;
  }
}

/** Oblik greške koju vraća Supabase (PostgREST) klijent. */
export interface DbError {
  message: string;
  code?: string;
}

/**
 * Pretvara grešku iz baze u AppError:
 *   - P0001 sa poznatim kodom: greška iz naše RPC funkcije (npr. TICKET_CLOSED)
 *   - 42501: nema prava (RLS ili prava na tabelu) -> FORBIDDEN
 *   - PGRST116: .single() nije našao red -> NOT_FOUND
 *   - sve ostalo: INTERNAL_ERROR (original ostaje kao uzrok, za log)
 */
export function fromDbError(error: DbError): AppError {
  if (error.code === "P0001" && isErrorCode(error.message)) {
    return new AppError(error.message, undefined, { cause: error });
  }
  if (error.code === "42501") return new AppError("FORBIDDEN", undefined, { cause: error });
  if (error.code === "PGRST116") return new AppError("NOT_FOUND", undefined, { cause: error });
  return new AppError("INTERNAL_ERROR", undefined, { cause: error });
}
