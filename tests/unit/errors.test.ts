/**
 * Unit testovi: kodovi grešaka, AppError i prevodi (src/lib/errors).
 *
 * Proverava da svaki kod ima HTTP status i prevod na oba jezika, i da se
 * greške iz baze (RPC funkcije, RLS) pretvaraju u prave kodove.
 */
import { describe, expect, it } from "vitest";

import { AppError, fromDbError } from "@/lib/errors/app-error";
import { ERROR_CODES, httpStatusFor, isErrorCode } from "@/lib/errors/codes";
import en from "../../messages/en.json";
import sr from "../../messages/sr.json";

describe("kodovi grešaka", () => {
  // Svaki kod mora imati prevod na srpskom i engleskom (interfejs prevodi po kodu).
  it("svaki kod ima prevod na oba jezika", () => {
    for (const code of ERROR_CODES) {
      expect(sr.errors[code], `sr: ${code}`).toBeTruthy();
      expect(en.errors[code], `en: ${code}`).toBeTruthy();
    }
    expect(Object.keys(sr.errors).sort()).toEqual([...ERROR_CODES].sort());
    expect(Object.keys(en.errors).sort()).toEqual([...ERROR_CODES].sort());
  });

  // HTTP statusi iz docs/06, sekcija 1.
  it("statusi odgovaraju dokumentaciji", () => {
    expect(httpStatusFor("VALIDATION_ERROR")).toBe(400);
    expect(httpStatusFor("UNAUTHENTICATED")).toBe(401);
    expect(httpStatusFor("NOT_ASSIGNED_AGENT")).toBe(403);
    expect(httpStatusFor("TICKET_NOT_FOUND")).toBe(404);
    expect(httpStatusFor("INVALID_STATUS_TRANSITION")).toBe(409);
    expect(httpStatusFor("INTERNAL_ERROR")).toBe(500);
  });

  it("isErrorCode prepoznaje samo poznate kodove", () => {
    expect(isErrorCode("TICKET_CLOSED")).toBe(true);
    expect(isErrorCode("NEPOSTOJECI")).toBe(false);
    expect(isErrorCode("toString")).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });
});

describe("fromDbError", () => {
  // Greška iz naše RPC funkcije (raise exception using message = 'TICKET_CLOSED').
  it("P0001 sa poznatim kodom postaje taj kod", () => {
    const error = fromDbError({ code: "P0001", message: "TICKET_CLOSED" });
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("TICKET_CLOSED");
    expect(error.httpStatus).toBe(409);
  });

  it("42501 (nema prava) postaje FORBIDDEN", () => {
    expect(fromDbError({ code: "42501", message: "permission denied" }).code).toBe("FORBIDDEN");
  });

  it("PGRST116 (nema reda) postaje NOT_FOUND", () => {
    expect(fromDbError({ code: "PGRST116", message: "0 rows" }).code).toBe("NOT_FOUND");
  });

  // Nepoznata greška ne otkriva detalje: INTERNAL_ERROR, original je samo uzrok.
  it("ostalo postaje INTERNAL_ERROR", () => {
    const original = { code: "23505", message: "duplicate key" };
    const error = fromDbError(original);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.cause).toBe(original);
  });
});
