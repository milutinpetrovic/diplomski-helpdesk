/**
 * Fajl: src/lib/validation/categories.ts
 * Svrha: Zod šeme za kategorije zahteva: oblik kategorije u odgovoru API-ja
 * i query parametar za GET /api/categories, i (Faza 8, admin) šeme za
 * dodavanje i izmenu kategorija, iste za formu i API.
 * Koriste ga: CategoryService, rute /api/categories i /api/admin/categories,
 * forma CategoryFormDialog, šeme zahteva
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

/** Ključevi poruka (validation.<ključ>) za forme kategorija. */
export const CATEGORY_VALIDATION_KEYS = {
  slugFormat: "slugFormat",
  categoryNameLength: "categoryNameLength",
  categoryDescriptionLength: "categoryDescriptionLength",
  sortOrderRange: "sortOrderRange",
} as const;

/** Oznaka u adresi i API-ju: mala slova, brojevi i crtice (kao CHECK u bazi). */
const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: CATEGORY_VALIDATION_KEYS.slugFormat })
  .max(60, { error: CATEGORY_VALIDATION_KEYS.slugFormat })
  .meta({ description: "Oznaka: mala slova, brojevi i crtice.", example: "network" });

/** Naziv na jednom jeziku (2–60 znakova, kao u bazi). */
const categoryNameSchema = z
  .string()
  .trim()
  .min(2, { error: CATEGORY_VALIDATION_KEYS.categoryNameLength })
  .max(60, { error: CATEGORY_VALIDATION_KEYS.categoryNameLength });

/** Opis na jednom jeziku (do 300 znakova; prazno = bez opisa). */
const categoryDescriptionSchema = z
  .string()
  .trim()
  .max(300, { error: CATEGORY_VALIDATION_KEYS.categoryDescriptionLength })
  .nullable()
  .transform((value) => (value ? value : null));

/** Redosled u listama (manji broj = ranije). */
const sortOrderSchema = z.coerce
  .number({ error: CATEGORY_VALIDATION_KEYS.sortOrderRange })
  .int({ error: CATEGORY_VALIDATION_KEYS.sortOrderRange })
  .min(0, { error: CATEGORY_VALIDATION_KEYS.sortOrderRange })
  .max(1000, { error: CATEGORY_VALIDATION_KEYS.sortOrderRange });

/** POST /api/admin/categories — nova kategorija (UC-22). */
export const createCategorySchema = z
  .strictObject({
    slug: slugSchema,
    nameEn: categoryNameSchema.meta({ example: "Network" }),
    nameSr: categoryNameSchema.meta({ example: "Mreža" }),
    descriptionEn: categoryDescriptionSchema
      .optional()
      .meta({ example: "Wi-Fi, VPN and internet access." }),
    descriptionSr: categoryDescriptionSchema
      .optional()
      .meta({ example: "Wi-Fi, VPN i pristup internetu." }),
    sortOrder: sortOrderSchema.default(0).meta({ example: 6 }),
  })
  .meta({ id: "CreateCategoryInput", description: "Nova kategorija zahteva (UC-22)." });

/**
 * PATCH /api/admin/categories/{id} — izmena (bar jedno polje). isActive = false
 * deaktivira kategoriju: postojeći zahtevi je zadržavaju, a nova se ne može izabrati.
 */
export const updateCategorySchema = z
  .strictObject({
    slug: slugSchema.optional(),
    nameEn: categoryNameSchema.optional(),
    nameSr: categoryNameSchema.optional(),
    descriptionEn: categoryDescriptionSchema.optional(),
    descriptionSr: categoryDescriptionSchema.optional(),
    sortOrder: sortOrderSchema.optional(),
    isActive: z.boolean().optional().meta({ example: false }),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    error: "required",
  })
  .meta({ id: "UpdateCategoryInput", description: "Izmena kategorije (bar jedno polje)." });

/** Parametar putanje {id} za PATCH /api/admin/categories/{id}. */
export const categoryIdParamsSchema = z.object({
  id: uuidSchema.meta({ description: "ID kategorije (uuid)." }),
});

export type Category = z.infer<typeof categorySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
