/**
 * Fajl: src/lib/validation/categories.ts
 * Svrha: Zod šeme za kategorije zahteva: oblik kategorije u odgovoru API-ja
 * i query parametar za GET /api/categories. Šeme za dodavanje i izmenu
 * kategorija (admin) dolaze u Fazi 8.
 * Koriste ga: CategoryService, ruta GET /api/categories, šeme zahteva
 * (kategorija uz zahtev) i Swagger (src/lib/openapi/routes/categories.ts).
 * Povezano sa: tabela categories (supabase/migrations/..._categories.sql),
 * docs/06-api-i-stranice.md (sekcija Kategorije).
 */
import { z } from "zod";

import { uuidSchema } from "@/lib/validation/common";

/** Kategorija u odgovoru API-ja (nazivi na oba jezika; UI bira po jeziku). */
export const categorySchema = z
  .object({
    id: uuidSchema.meta({ example: "10000000-0000-4000-8000-000000000001" }),
    slug: z.string().meta({ example: "technical" }),
    nameEn: z.string().meta({ example: "Technical issue" }),
    nameSr: z.string().meta({ example: "Tehnički problem" }),
    descriptionEn: z.string().nullable().meta({ example: "Errors, crashes and problems." }),
    descriptionSr: z.string().nullable().meta({ example: "Greške, padovi i problemi u radu." }),
    isActive: z.boolean().meta({ example: true }),
    sortOrder: z.number().int().meta({ example: 1 }),
  })
  .meta({ id: "Category", description: "Kategorija zahteva." });

/**
 * GET /api/categories?includeInactive=true — i neaktivne kategorije (samo admin).
 * Vrednost je tekst iz adrese ("true" / "false").
 */
export const categoryListQuerySchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .meta({ description: "true = i neaktivne kategorije (samo admin).", example: "false" }),
});

export type Category = z.infer<typeof categorySchema>;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
