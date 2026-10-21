/**
 * Fajl: src/lib/validation/admin.ts
 * Svrha: Zod šeme za administraciju naloga:
 *   - spisak agenata za dodelu (GET /api/agents, Faza 5)
 *   - lista svih naloga sa pretragom i filterima (GET /api/admin/users, Faza 8)
 *   - izmena uloge i aktivnosti naloga (PATCH /api/admin/users/{id}, Faza 8)
 * Koriste ga: UserAdminService, rute /api/agents i /api/admin/users, stranica
 * /admin/users i Swagger (routes/admin.ts).
 * Povezano sa: docs/06-api-i-stranice.md (sekcija Administracija).
 */
import { z } from "zod";

import {
  paginatedSchema,
  paginationSchema,
  profileSummarySchema,
  uuidSchema,
} from "@/lib/validation/common";
import { profileSchema } from "@/lib/validation/profile";
import { USER_ROLES } from "@/types/domain";

/** Agent (ili admin) u spisku za dodelu, sa brojem nerešenih dodeljenih zahteva. */
export const agentSummarySchema = profileSummarySchema
  .extend({
    openAssignedCount: z
      .number()
      .int()
      .meta({ description: "Broj dodeljenih zahteva koji nisu rešeni ni zatvoreni.", example: 3 }),
  })
  .meta({ id: "AgentSummary", description: "Član tima podrške za dodelu zahteva." });

/**
 * GET /api/admin/users — pretraga (?q po imenu ili emailu), filteri uloge i
 * aktivnosti (?isActive=true|false) i paginacija.
 */
export const userListQuerySchema = paginationSchema.extend({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .meta({ description: "Deo imena ili emaila.", example: "jelena" }),
  role: z.enum(USER_ROLES).optional().meta({ example: "agent" }),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .meta({ description: "true = samo aktivni, false = samo deaktivirani.", example: "true" }),
});

/**
 * PATCH /api/admin/users/{id} — nova uloga i/ili aktivnost (bar jedno polje).
 * Admin ne može da menja sopstveni nalog (CANNOT_MODIFY_SELF); kad agent ili
 * admin izgubi ulogu tima ili bude deaktiviran, njegovi nerešeni zahtevi se
 * vraćaju u red (baza, funkcija admin_update_user).
 */
export const adminUpdateUserSchema = z
  .strictObject({
    role: z.enum(USER_ROLES).optional().meta({ example: "agent" }),
    isActive: z.boolean().optional().meta({ example: false }),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    error: "required",
  })
  .meta({
    id: "AdminUpdateUserInput",
    description: "Izmena uloge i/ili aktivnosti naloga (UC-21).",
  });

/** Parametar putanje {id} za PATCH /api/admin/users/{id}. */
export const userIdParamsSchema = z.object({
  id: uuidSchema.meta({
    description: "ID naloga (uuid).",
    example: "00000000-0000-4000-8000-000000000002",
  }),
});

/**
 * Nalog u listi za administraciju: profil i broj nerešenih zahteva koji su
 * mu dodeljeni (da admin pre oduzimanja uloge vidi koliko zahteva se vraća u red).
 */
export const adminUserSchema = profileSchema
  .extend({
    openAssignedCount: z
      .number()
      .int()
      .meta({ description: "Dodeljeni zahtevi koji nisu rešeni ni zatvoreni.", example: 3 }),
  })
  .meta({ id: "AdminUser", description: "Nalog sa brojem dodeljenih nerešenih zahteva." });

/** Stranica naloga (odgovor GET /api/admin/users). */
export const adminUserListSchema = paginatedSchema(adminUserSchema, "PaginatedAdminUserList");

export type AgentSummary = z.infer<typeof agentSummarySchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
