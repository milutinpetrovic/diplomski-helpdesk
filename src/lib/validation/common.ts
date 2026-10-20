/**
 * Fajl: src/lib/validation/common.ts
 * Svrha: zajedničke Zod šeme koje koristi više domena: ID (uuid), paginacija
 * liste (?page=1&pageSize=20), oblik stranice rezultata i kratak prikaz
 * korisnika (ime i uloga, bez emaila).
 * Koriste ga: src/lib/validation/tickets.ts, comments.ts, categories.ts,
 * admin.ts i Swagger dokumentacija ruta (src/lib/openapi/routes/).
 * Povezano sa: docs/06-api-i-stranice.md (sekcija 1: paginacija, sekcija 3: šeme).
 */
import { z } from "zod";

import { USER_ROLES } from "@/types/domain";

/** ID u bazi (uuid). Primer je ID prvog demo zahteva iz supabase/seed.sql. */
export const uuidSchema = z.uuid().meta({ example: "20000000-0000-4000-8000-000000000001" });

/** Parametar putanje {id}, npr. /api/tickets/{id}. */
export const idParamsSchema = z.object({
  id: uuidSchema.meta({ description: "ID zahteva (uuid)." }),
});

/** Najveća dozvoljena veličina stranice (docs/06: max 100). */
export const MAX_PAGE_SIZE = 100;

/**
 * Paginacija: ?page=1&pageSize=20. Vrednosti iz adrese stižu kao tekst,
 * pa ih z.coerce pretvara u brojeve.
 */
export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .meta({ description: "Broj stranice (od 1).", example: 1 }),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(20)
    .meta({ description: `Broj stavki po stranici (1–${MAX_PAGE_SIZE}).`, example: 20 }),
});

/**
 * Oblik stranice rezultata: { items, page, pageSize, total }.
 * Ulaz: šema jedne stavke i naziv za Swagger (npr. "PaginatedTicketList").
 */
export function paginatedSchema<T extends z.ZodType>(item: T, id: string) {
  return z
    .object({
      items: z.array(item),
      page: z.number().int().meta({ example: 1 }),
      pageSize: z.number().int().meta({ example: 20 }),
      total: z
        .number()
        .int()
        .meta({ description: "Ukupan broj stavki (sve stranice).", example: 12 }),
    })
    .meta({ id, description: "Jedna stranica rezultata." });
}

/** Stranica rezultata u kodu (servisi vraćaju ovaj oblik). */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Kratak prikaz korisnika (pogled profile_summaries u bazi): ime, slika i
 * uloga, BEZ emaila. Koristi se za podnosioca, dodeljenog agenta i autora komentara.
 */
export const profileSummarySchema = z
  .object({
    id: uuidSchema.meta({ example: "00000000-0000-4000-8000-000000000002" }),
    fullName: z.string().meta({ example: "Jelena Agentić" }),
    avatarUrl: z.string().nullable().meta({ example: null }),
    role: z.enum(USER_ROLES).meta({ example: "agent" }),
  })
  .meta({ id: "ProfileSummary", description: "Ime i uloga korisnika (bez emaila)." });

export type ProfileSummary = z.infer<typeof profileSummarySchema>;
