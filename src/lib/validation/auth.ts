/**
 * Fajl: src/lib/validation/auth.ts
 * Svrha: Zod šeme za prijavu, registraciju i reset lozinke. Ista šema se
 * koristi na tri mesta: u formi (react-hook-form), u API ruti (withApi) i u
 * Swagger dokumentaciji (src/lib/openapi/routes/auth.ts).
 * Poruke grešaka nisu tekst nego KLJUČEVI prevoda (npr. "passwordWeak");
 * forma ih prevodi preko messages/*.json (sekcija validation), a API ih
 * vraća u details.fields, pa su iste i u Swagger-u i u interfejsu.
 * Povezano sa: docs/06-api-i-stranice.md, sekcija 3.
 */
import { z } from "zod";

/**
 * Ključevi poruka za greške po poljima (messages/*.json -> validation.<ključ>).
 * Zajednički za sve forme vezane za nalog.
 */
export const VALIDATION_KEYS = {
  required: "required",
  fullNameLength: "fullNameLength",
  emailInvalid: "emailInvalid",
  passwordWeak: "passwordWeak",
  passwordTooLong: "passwordTooLong",
  passwordMismatch: "passwordMismatch",
  passwordSame: "passwordSame",
} as const;

/** Ime i prezime: 2–100 znakova (razmaci na krajevima se uklanjaju). */
export const fullNameSchema = z
  .string({ error: VALIDATION_KEYS.required })
  .trim()
  .min(2, { error: VALIDATION_KEYS.fullNameLength })
  .max(100, { error: VALIDATION_KEYS.fullNameLength })
  .meta({ example: "Ana Jovanović" });

/** Email adresa (razmaci se uklanjaju, mala slova). */
export const emailSchema = z
  .string({ error: VALIDATION_KEYS.required })
  .trim()
  .toLowerCase()
  .regex(z.regexes.email, { error: VALIDATION_KEYS.emailInvalid })
  .meta({ format: "email", example: "ana@helpdesk.test" });

/**
 * Nova lozinka: najmanje 8 znakova, bar jedno slovo i bar jedan broj.
 * Najviše 72 znaka, jer Supabase (bcrypt) duže lozinke ne razlikuje.
 */
export const newPasswordSchema = z
  .string({ error: VALIDATION_KEYS.required })
  .min(8, { error: VALIDATION_KEYS.passwordWeak })
  .max(72, { error: VALIDATION_KEYS.passwordTooLong })
  .regex(/\p{L}/u, { error: VALIDATION_KEYS.passwordWeak })
  .regex(/\d/, { error: VALIDATION_KEYS.passwordWeak })
  .meta({ example: "Lozinka123!" });

/** POST /api/auth/register — registracija novog korisnika (uloga je uvek customer). */
export const registerSchema = z
  .strictObject({
    fullName: fullNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
  })
  .meta({ id: "RegisterInput", description: "Podaci za registraciju (UC-01)." });

/**
 * Forma za registraciju: isto kao registerSchema, plus ponovljena lozinka.
 * confirmPassword se proverava samo na klijentu i ne šalje se API-ju.
 */
export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string({ error: VALIDATION_KEYS.required }) })
  .refine((data) => data.password === data.confirmPassword, {
    error: VALIDATION_KEYS.passwordMismatch,
    path: ["confirmPassword"],
  });

/** POST /api/auth/login — prijava emailom i lozinkom. Lozinka se ovde ne proverava po pravilima. */
export const loginSchema = z
  .strictObject({
    email: emailSchema,
    password: z
      .string({ error: VALIDATION_KEYS.required })
      .min(1, { error: VALIDATION_KEYS.required })
      .meta({ example: "Lozinka123!" }),
  })
  .meta({ id: "LoginInput", description: "Email i lozinka (UC-02)." });

/** POST /api/auth/password/forgot — zahtev za link za reset lozinke. */
export const forgotPasswordSchema = z
  .strictObject({ email: emailSchema })
  .meta({ id: "ForgotPasswordInput", description: "Email naloga kome se šalje link (UC-04)." });

/** POST /api/auth/password/reset — nova lozinka (posle linka iz emaila ili sa profila). */
export const resetPasswordSchema = z
  .strictObject({ password: newPasswordSchema })
  .meta({ id: "ResetPasswordInput", description: "Nova lozinka (UC-04, UC-06)." });

/** Forma za novu lozinku: lozinka + ponovljena lozinka (provera samo na klijentu). */
export const resetPasswordFormSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string({ error: VALIDATION_KEYS.required }) })
  .refine((data) => data.password === data.confirmPassword, {
    error: VALIDATION_KEYS.passwordMismatch,
    path: ["confirmPassword"],
  });

/** Podrazumevana stranica posle prijave. */
export const DEFAULT_NEXT_PATH = "/dashboard";

/**
 * Parametar ?next= (putanja na koju se korisnik vraća posle prijave, npr. /tickets/5).
 * Sama provera bezbednosti je u safeNextPath, jer neispravna vrednost ne treba
 * da izazove grešku nego povratak na /dashboard.
 */
export const nextPathSchema = z
  .string()
  .max(500)
  .optional()
  .meta({ example: DEFAULT_NEXT_PATH, description: "Putanja u aplikaciji posle prijave." });

/**
 * Vraća bezbednu putanju za preusmerenje posle prijave.
 * Dozvoljena je samo putanja unutar aplikacije ("/..."), nikad druga adresa
 * ("//zli-sajt.com", "https://..."), da link za prijavu ne bi mogao da
 * preusmeri korisnika na tuđ sajt (open redirect napad).
 * Ulaz: vrednost iz ?next=. Vraća: ta putanja ili /dashboard.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || value.length > 500) return DEFAULT_NEXT_PATH;
  return /^\/(?![/\\])/.test(value) ? value : DEFAULT_NEXT_PATH;
}

/** Query za GET /api/auth/google. */
export const googleQuerySchema = z.object({ next: nextPathSchema });

/**
 * Query za GET /api/auth/callback. Stiže ili `code` (Google prijava, PKCE),
 * ili `token_hash` + `type` (link iz emaila: potvrda naloga ili reset lozinke),
 * ili `error` (korisnik je odustao na Google-u).
 */
export const callbackQuerySchema = z.object({
  code: z.string().optional(),
  token_hash: z.string().optional(),
  type: z.enum(["email", "signup", "recovery"]).optional().catch(undefined),
  next: nextPathSchema,
  error: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;
export type CallbackQuery = z.infer<typeof callbackQuerySchema>;
