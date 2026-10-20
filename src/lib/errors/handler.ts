/**
 * Fajl: src/lib/errors/handler.ts
 * Svrha: centralna obrada grešaka za API rute (ApiErrorHandler). Svaku grešku
 * pretvara u isti JSON oblik:
 *   { "error": { "code": "TICKET_NOT_FOUND", "message": "...", "details": {...} } }
 * Koristi ga: withApi (src/lib/api/with-api.ts) u try/catch oko svake rute.
 * Povezano sa: AppError, kodovima grešaka i prevodima u messages/*.json
 * (message je na jeziku iz zaglavlja Accept-Language; interfejs ipak prevodi
 * po kodu, a message služi za Swagger, Postman i logove).
 */
import { ZodError, z } from "zod";

import { AppError, type ErrorDetails } from "@/lib/errors/app-error";
import type { ErrorCode } from "@/lib/errors/codes";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import en from "../../../messages/en.json";
import sr from "../../../messages/sr.json";

/** Tekstovi grešaka po jeziku (sekcija "errors" u messages/*.json). */
const ERROR_MESSAGES: Record<Locale, Record<ErrorCode, string>> = {
  sr: sr.errors,
  en: en.errors,
};

/** JSON oblik greške koji vraća svaka API ruta. */
export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: ErrorDetails };
}

/**
 * Bira jezik poruke iz zaglavlja Accept-Language (npr. "en-US,en;q=0.9" -> "en").
 * Ako jezik nije podržan, vraća podrazumevani (srpski).
 */
export function localeFromRequest(request: Request): Locale {
  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const language = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    if (isLocale(language)) return language;
  }
  return defaultLocale;
}

/**
 * Pretvara bilo koju grešku u HTTP odgovor.
 *   - AppError -> njen kod i status
 *   - ZodError -> 400 VALIDATION_ERROR sa greškama po poljima (details.fields)
 *   - sve ostalo -> 500 INTERNAL_ERROR; detalji idu samo u log servera
 * Ulaz: greška i jezik poruke. Vraća: Response sa JSON telom ApiErrorBody.
 */
export function toErrorResponse(error: unknown, locale: Locale = defaultLocale): Response {
  // Korak 1: svodimo grešku na AppError.
  let appError: AppError;
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = new AppError("VALIDATION_ERROR", { fields: z.flattenError(error).fieldErrors });
  } else {
    appError = new AppError("INTERNAL_ERROR", undefined, { cause: error });
  }

  // Korak 2: neočekivane greške beležimo u log (klijent ne vidi detalje).
  if (appError.code === "INTERNAL_ERROR") {
    console.error("[api] neočekivana greška:", appError.cause ?? error);
  }

  // Korak 3: jedinstveno JSON telo.
  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: ERROR_MESSAGES[locale][appError.code],
      ...(appError.details ? { details: appError.details } : {}),
    },
  };
  return Response.json(body, { status: appError.httpStatus });
}
