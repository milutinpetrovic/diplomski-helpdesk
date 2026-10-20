/**
 * Fajl: src/lib/validation/profile.ts
 * Svrha: Zod šeme za profil korisnika: izmena sopstvenog profila (ulaz za
 * PATCH /api/me i formu na /profile) i oblik profila u odgovoru API-ja (za Swagger).
 * Povezano sa: ProfileService, docs/06-api-i-stranice.md (sekcija 3),
 * tabela profiles (supabase/migrations/..._profiles.sql).
 */
import { z } from "zod";

import { locales } from "@/lib/i18n/config";
import { fullNameSchema } from "@/lib/validation/auth";
import { USER_ROLES } from "@/types/domain";

/**
 * PATCH /api/me — korisnik menja SAMO ime i jezik. strictObject odbija
 * svako drugo polje (npr. role ili email) greškom 400, a baza ionako
 * dozvoljava izmenu samo kolona full_name, avatar_url i locale.
 */
export const updateProfileSchema = z
  .strictObject({
    fullName: fullNameSchema.optional(),
    locale: z.enum(locales).optional().meta({ example: "en" }),
  })
  .refine((data) => data.fullName !== undefined || data.locale !== undefined, {
    error: "required",
  })
  .meta({ id: "UpdateProfileInput", description: "Izmena sopstvenog profila (UC-06, UC-07)." });

/**
 * Forma na stranici /profile: oba polja su uvek popunjena (trenutne vrednosti),
 * a šalje se isto telo kao za PATCH /api/me.
 */
export const profileFormSchema = z.object({
  fullName: fullNameSchema,
  locale: z.enum(locales),
});

/** Profil u odgovoru API-ja (camelCase, bez internih kolona). */
export const profileSchema = z
  .object({
    id: z.uuid().meta({ example: "00000000-0000-4000-8000-000000000004" }),
    fullName: z.string().meta({ example: "Ana Jovanović" }),
    email: z.string().meta({ example: "ana@helpdesk.test" }),
    avatarUrl: z.string().nullable().meta({ example: null }),
    role: z.enum(USER_ROLES).meta({ example: "customer" }),
    locale: z.enum(locales).meta({ example: "sr" }),
    isActive: z.boolean().meta({ example: true }),
    createdAt: z.string().meta({ example: "2026-10-20T18:00:00.000Z" }),
  })
  .meta({ id: "Profile", description: "Profil korisnika." });

export type ProfileFormInput = z.infer<typeof profileFormSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type Profile = z.infer<typeof profileSchema>;
