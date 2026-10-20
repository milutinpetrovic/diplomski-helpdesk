/**
 * Unit testovi: Zod šeme za nalog i profil (src/lib/validation/auth.ts i profile.ts).
 *
 * Proverava pravila iz docs/06 (sekcija 3): ime 2–100 znakova, ispravan email,
 * lozinka najmanje 8 znakova sa slovom i brojem, poklapanje ponovljene lozinke,
 * zabranu nepoznatih polja (npr. uloge) i bezbednu putanju posle prijave.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_NEXT_PATH,
  loginSchema,
  registerFormSchema,
  registerSchema,
  safeNextPath,
} from "@/lib/validation/auth";
import { updateProfileSchema } from "@/lib/validation/profile";

/** Ključevi grešaka po poljima (isti oblik koji vraća API u details.fields). */
function fieldErrors(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe("registerSchema", () => {
  const valid = { fullName: "Ana Jovanović", email: "Ana@Helpdesk.test ", password: "Lozinka1" };

  it("prihvata ispravne podatke; email se čisti i pretvara u mala slova", () => {
    expect(registerSchema.parse(valid).email).toBe("ana@helpdesk.test");
  });

  it.each([
    ["kratka lozinka", "Ab1", "passwordWeak"],
    ["lozinka bez broja", "Lozinkaaa", "passwordWeak"],
    ["lozinka bez slova", "12345678", "passwordWeak"],
    ["predugačka lozinka", `A1${"x".repeat(80)}`, "passwordTooLong"],
  ])("odbija: %s", (_name, password, key) => {
    expect(fieldErrors(registerSchema.safeParse({ ...valid, password })).password).toBe(key);
  });

  it("odbija kratko ime i neispravan email", () => {
    const errors = fieldErrors(registerSchema.safeParse({ ...valid, fullName: "A", email: "x@" }));
    expect(errors).toMatchObject({ fullName: "fullNameLength", email: "emailInvalid" });
  });

  it("odbija dodatna polja (npr. uloga se ne bira pri registraciji)", () => {
    expect(registerSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });

  it("forma proverava da se lozinke poklapaju", () => {
    const result = registerFormSchema.safeParse({ ...valid, confirmPassword: "Drugacija1" });
    expect(fieldErrors(result).confirmPassword).toBe("passwordMismatch");
  });
});

describe("loginSchema", () => {
  it("ne proverava pravila lozinke (stari nalozi), samo da nije prazna", () => {
    expect(loginSchema.safeParse({ email: "ana@helpdesk.test", password: "x" }).success).toBe(true);
    expect(
      fieldErrors(loginSchema.safeParse({ email: "ana@helpdesk.test", password: "" })),
    ).toEqual({
      password: "required",
    });
  });
});

describe("updateProfileSchema", () => {
  it("prihvata ime i/ili jezik", () => {
    expect(updateProfileSchema.safeParse({ locale: "en" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ fullName: "Ana" }).success).toBe(true);
  });

  it("odbija prazan zahtev, nepoznat jezik i polja koja korisnik ne sme da menja", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.safeParse({ locale: "de" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ email: "novi@helpdesk.test" }).success).toBe(false);
  });
});

describe("safeNextPath (zaštita od open redirect napada)", () => {
  it.each(["/dashboard", "/tickets/5?tab=history", "/profile"])("dozvoljava %s", (value) => {
    expect(safeNextPath(value)).toBe(value);
  });

  it.each([null, "", "https://zli-sajt.com", "//zli-sajt.com", "/\\zli-sajt.com", "dashboard"])(
    "odbija %s i vraća /dashboard",
    (value) => {
      expect(safeNextPath(value)).toBe(DEFAULT_NEXT_PATH);
    },
  );
});
