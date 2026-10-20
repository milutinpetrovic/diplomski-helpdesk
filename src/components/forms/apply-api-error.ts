/**
 * Fajl: src/components/forms/apply-api-error.ts
 * Svrha: prikaz greške iz API-ja u formi. Ako je API vratio greške po poljima
 * (VALIDATION_ERROR sa details.fields), upisuje ih ispod odgovarajućih polja;
 * inače vraća kod greške koji forma prikazuje iznad dugmeta (preveden preko errors.<KOD>).
 * Koriste ga: forme za prijavu, registraciju, lozinku i profil.
 * Povezano sa: ApiClientError (src/lib/api/client.ts), withApi (oblik details.fields).
 */
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiClientError } from "@/lib/api/client";
import type { ErrorCode } from "@/lib/errors/codes";

/**
 * Ulaz: uhvaćena greška, setError iz react-hook-form i imena polja forme.
 * Vraća: kod greške za poruku iznad forme, ili null ako su sve greške
 * prikazane ispod polja.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: readonly Path<T>[],
): ErrorCode | null {
  // Korak 1: greška koja nije iz API-ja (ne bi smelo da se desi) -> opšta poruka.
  if (!(error instanceof ApiClientError)) return "INTERNAL_ERROR";

  // Korak 2: greške po poljima -> ispod polja.
  const fields = error.details?.fields as Record<string, string[] | undefined> | undefined;
  if (error.code === "VALIDATION_ERROR" && fields) {
    let shown = false;
    for (const name of fieldNames) {
      const key = fields[name]?.[0];
      if (key) {
        setError(name, { type: "server", message: key });
        shown = true;
      }
    }
    if (shown) return null;
  }

  // Korak 3: ostale greške -> poruka iznad dugmeta.
  return error.code;
}
