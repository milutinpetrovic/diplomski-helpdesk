/**
 * Fajl: src/lib/openapi/routes/auth.ts
 * Svrha: Swagger dokumentacija ruta za prijavu i naloge (tag Auth): registracija,
 * prijava, odjava, Google prijava, callback i reset lozinke.
 * Šeme ulaza su iste Zod šeme koje koriste API rute (src/lib/validation/auth.ts).
 * Povezano sa: src/app/api/auth/**, docs/06-api-i-stranice.md (sekcija Auth).
 */
import { z } from "zod";

import { bearerAuth, errorResponses, registry } from "@/lib/openapi/registry";
import {
  forgotPasswordSchema,
  loginSchema,
  nextPathSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import { profileSchema } from "@/lib/validation/profile";

/** Telo JSON zahteva za Swagger (ista Zod šema kao u ruti). */
function jsonBody(schema: z.ZodType) {
  return { content: { "application/json": { schema } } };
}

/** Odgovor na uspešnu prijavu (POST /api/auth/login). */
const LoginResponseSchema = z
  .object({
    profile: profileSchema,
    session: z.object({
      accessToken: z.string().meta({
        description: "JWT; za Swagger ga nalepite u „Authorize“ (bez reči Bearer).",
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      }),
      expiresAt: z.number().nullable().meta({
        description: "Kada token ističe (Unix vreme u sekundama).",
        example: 1792512000,
      }),
    }),
  })
  .meta({ id: "LoginResult" });

// POST /api/auth/register — registracija (UC-01).
registry.registerPath({
  method: "post",
  path: "/api/auth/register",
  tags: ["Auth"],
  summary: "Registracija",
  description:
    "Pravi nov nalog sa ulogom customer i šalje email za potvrdu. Nalog se ne može koristiti " +
    "dok korisnik ne klikne na link iz emaila. Jezik profila se uzima iz Accept-Language. " +
    "Uloge: gost (bez prijave).",
  request: { body: jsonBody(registerSchema) },
  responses: {
    201: { description: "Nalog je napravljen; poslat je email za potvrdu." },
    ...errorResponses([400, 409, 429], { 409: "EMAIL_ALREADY_REGISTERED" }),
  },
});

// POST /api/auth/login — prijava emailom i lozinkom (UC-02).
registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["Auth"],
  summary: "Prijava emailom i lozinkom",
  description:
    "Proverava email i lozinku, postavlja kolačiće sesije i vraća profil i pristupni token. " +
    "Token (session.accessToken) se koristi za dugme „Authorize“ u ovom Swagger-u. " +
    "Demo nalozi: admin@helpdesk.test, agent@helpdesk.test, ana@helpdesk.test (lozinka Lozinka123!). " +
    "Uloge: gost (bez prijave).",
  request: {
    body: {
      content: {
        "application/json": {
          schema: loginSchema,
          example: { email: "ana@helpdesk.test", password: "Lozinka123!" },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Uspešna prijava.",
      content: { "application/json": { schema: LoginResponseSchema } },
    },
    ...errorResponses([400, 401, 403, 429], {
      401: "INVALID_CREDENTIALS",
      403: "EMAIL_NOT_CONFIRMED",
    }),
  },
});

// POST /api/auth/logout — odjava (UC-05).
registry.registerPath({
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "Odjava",
  description: "Poništava sesiju kod Supabase-a i briše kolačiće. Uloge: customer, agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    204: { description: "Korisnik je odjavljen." },
    ...errorResponses([401]),
  },
});

// GET /api/auth/google — početak Google prijave (UC-03).
registry.registerPath({
  method: "get",
  path: "/api/auth/google",
  tags: ["Auth"],
  summary: "Prijava Google nalogom (početak)",
  description:
    "Preusmerava pregledač na Google stranicu za prijavu (preko Supabase Auth-a). Posle prijave " +
    "Google vraća korisnika na /api/auth/callback. Ako već postoji potvrđen nalog sa istim emailom, " +
    "Google se vezuje za taj nalog. Otvara se kao link u pregledaču, ne iz Swagger-a. Uloge: gost.",
  request: { query: z.object({ next: nextPathSchema }) },
  responses: {
    302: { description: "Preusmerenje na Google." },
    ...errorResponses([]),
  },
});

// GET /api/auth/callback — povratak sa Google-a ili iz linka u emailu (UC-01, UC-03, UC-04).
registry.registerPath({
  method: "get",
  path: "/api/auth/callback",
  tags: ["Auth"],
  summary: "Povratak posle Google prijave ili linka iz emaila",
  description:
    "Zamenjuje code (Google) ili token_hash + type (link iz emaila: potvrda naloga ili reset lozinke) " +
    "za sesiju i preusmerava na `next`. Kod greške preusmerava na /login?error=<KOD> " +
    "(npr. AUTH_CALLBACK_FAILED kad je link istekao). Uloge: gost.",
  request: {
    query: z.object({
      code: z.string().optional().meta({ description: "Kod koji vraća Google prijava (PKCE)." }),
      token_hash: z.string().optional().meta({ description: "Token iz linka u emailu." }),
      type: z
        .enum(["email", "recovery"])
        .optional()
        .meta({ description: "email = potvrda naloga, recovery = reset lozinke." }),
      next: nextPathSchema,
      error: z.string().optional().meta({ description: "Greška koju vraća Google/Supabase." }),
    }),
  },
  responses: {
    302: { description: "Preusmerenje na `next` (uspeh) ili na /login?error=<KOD> (greška)." },
  },
});

// POST /api/auth/password/forgot — link za reset lozinke (UC-04).
registry.registerPath({
  method: "post",
  path: "/api/auth/password/forgot",
  tags: ["Auth"],
  summary: "Zaboravljena lozinka",
  description:
    "Šalje email sa linkom za postavljanje nove lozinke. Uvek vraća 204, i kad nalog ne postoji, " +
    "da se ne bi otkrilo koji emailovi imaju nalog. Uloge: gost.",
  request: { body: jsonBody(forgotPasswordSchema) },
  responses: {
    204: { description: "Zahtev je primljen." },
    ...errorResponses([400, 429]),
  },
});

// POST /api/auth/password/reset — nova lozinka (UC-04).
registry.registerPath({
  method: "post",
  path: "/api/auth/password/reset",
  tags: ["Auth"],
  summary: "Nova lozinka",
  description:
    "Postavlja novu lozinku prijavljenom korisniku: posle linka iz emaila (sesija iz linka) ili sa " +
    "stranice profila. Lozinka: najmanje 8 znakova, bar jedno slovo i jedan broj. " +
    "Uloge: customer, agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: { body: jsonBody(resetPasswordSchema) },
  responses: {
    204: { description: "Lozinka je promenjena." },
    ...errorResponses([400, 401]),
  },
});
