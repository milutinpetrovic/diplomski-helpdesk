/**
 * Unit testovi: prevod grešaka Supabase Auth-a u kodove aplikacije
 * (src/services/auth/auth-errors.ts).
 */
import { describe, expect, it } from "vitest";

import { mapAuthError } from "@/services/auth/auth-errors";

describe("mapAuthError", () => {
  it.each([
    ["invalid_credentials", "INVALID_CREDENTIALS", 401],
    ["email_not_confirmed", "EMAIL_NOT_CONFIRMED", 403],
    ["user_already_exists", "EMAIL_ALREADY_REGISTERED", 409],
    ["email_exists", "EMAIL_ALREADY_REGISTERED", 409],
    ["over_email_send_rate_limit", "RATE_LIMITED", 429],
    ["user_banned", "ACCOUNT_DISABLED", 403],
    ["session_not_found", "UNAUTHENTICATED", 401],
    ["neki_novi_kod", "INTERNAL_ERROR", 500],
  ])("%s -> %s (%i)", (supabaseCode, code, status) => {
    const error = mapAuthError({ code: supabaseCode });
    expect(error.code).toBe(code);
    expect(error.httpStatus).toBe(status);
  });

  it("slaba ili ista lozinka postaje greška polja password", () => {
    expect(mapAuthError({ code: "weak_password" }).details).toEqual({
      fields: { password: ["passwordWeak"] },
    });
    expect(mapAuthError({ code: "same_password" }).details).toEqual({
      fields: { password: ["passwordSame"] },
    });
  });

  it("nedostaje sesija (greška bez koda) -> UNAUTHENTICATED", () => {
    expect(mapAuthError({ message: "Auth session missing!" }).code).toBe("UNAUTHENTICATED");
  });

  it("originalna greška ostaje kao uzrok (za log servera)", () => {
    const original = { code: "neki_novi_kod", message: "detalji" };
    expect(mapAuthError(original).cause).toBe(original);
  });
});
