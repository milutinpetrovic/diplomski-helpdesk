/**
 * Fajl: src/lib/openapi/registry.ts
 * Svrha: OpenApiRegistry — zajednički registar u koji se upisuje dokumentacija
 * svake API rute i šeme (za Swagger UI na /api-docs i Postman).
 * Dokumentacija se pravi iz ISTIH Zod šema koje proveravaju ulaz u rutama,
 * pa Swagger uvek odgovara stvarnom kodu.
 * Koriste ga: src/lib/openapi/routes/<domen>.ts (registracija ruta) i
 * document.ts (pravljenje OpenAPI dokumenta).
 * Povezano sa: CLAUDE.md, sekcija „API dokumentacija (Swagger)“, docs/06.
 */
import { OpenAPIRegistry, type RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { ERROR_CODES, type ErrorCode } from "@/lib/errors/codes";
import sr from "../../../messages/sr.json";

/** Jedan registar za celu aplikaciju. */
export const registry = new OpenAPIRegistry();

/**
 * Šema prijave za Swagger dugme „Authorize“: Supabase pristupni token (JWT)
 * u zaglavlju `Authorization: Bearer <token>`.
 */
export const bearerAuth = registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Supabase pristupni token (access_token) prijavljenog korisnika.",
});

/** Šema greške: isti oblik vraća svaka ruta (src/lib/errors/handler.ts). */
export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: z.enum(ERROR_CODES).meta({ example: "TICKET_NOT_FOUND" }),
      message: z.string().meta({ example: "Zahtev ne postoji ili nemate pristup njemu." }),
      details: z.record(z.string(), z.unknown()).optional().meta({
        description: "Dodatni podaci, npr. fields (greške po poljima) za VALIDATION_ERROR.",
      }),
    }),
  })
  .meta({ id: "ApiError", description: "Jedinstven oblik greške svih API ruta." });

/** Opis HTTP statusa grešaka (za odgovore u Swagger-u). */
const ERROR_STATUS_DESCRIPTIONS = {
  400: "Neispravan ulaz (VALIDATION_ERROR, greške po poljima u details.fields).",
  401: "Korisnik nije prijavljen (UNAUTHENTICATED).",
  403: "Uloga nema pravo na ovu radnju (FORBIDDEN, ACCOUNT_DISABLED...).",
  404: "Ne postoji ili korisnik nema pristup (NOT_FOUND, TICKET_NOT_FOUND).",
  409: "Konflikt sa trenutnim stanjem (npr. INVALID_STATUS_TRANSITION).",
  429: "Previše zahteva u kratkom roku (RATE_LIMITED).",
  500: "Neočekivana greška (INTERNAL_ERROR).",
} as const;

/** Tipičan kod greške za svaki status (za primer u Swagger-u). */
const ERROR_STATUS_EXAMPLE_CODES: Record<keyof typeof ERROR_STATUS_DESCRIPTIONS, ErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "INVALID_STATUS_TRANSITION",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
};

/** HTTP status greške koji ruta može da vrati. */
export type ErrorStatus = keyof typeof ERROR_STATUS_DESCRIPTIONS;

/**
 * Pravi deo `responses` za greške koje ruta može da vrati.
 * Ulaz: spisak statusa, npr. [400, 401, 403] (status 500 se uvek dodaje) i,
 * opciono, kod greške za primer po statusu kad se razlikuje od tipičnog
 * (npr. { 401: "INVALID_CREDENTIALS" } za prijavu).
 */
export function errorResponses(
  statuses: readonly ErrorStatus[],
  examples: Partial<Record<ErrorStatus, ErrorCode>> = {},
): RouteConfig["responses"] {
  const responses: RouteConfig["responses"] = {};
  for (const status of new Set<ErrorStatus>([...statuses, 500])) {
    const code = examples[status] ?? ERROR_STATUS_EXAMPLE_CODES[status];
    responses[status] = {
      description: ERROR_STATUS_DESCRIPTIONS[status],
      content: {
        "application/json": {
          schema: ApiErrorSchema,
          example: { error: { code, message: sr.errors[code] } },
        },
      },
    };
  }
  return responses;
}

/**
 * Telo JSON zahteva za Swagger (ista Zod šema kao u ruti), uz opcioni primer
 * koji Swagger UI popunjava kod „Try it out“.
 */
export function jsonBody(schema: z.ZodType, example?: unknown) {
  return {
    content: { "application/json": { schema, ...(example === undefined ? {} : { example }) } },
  };
}

/** Uspešan JSON odgovor za Swagger: opis i Zod šema tela odgovora. */
export function jsonResponse(description: string, schema: z.ZodType) {
  return { description, content: { "application/json": { schema } } };
}
