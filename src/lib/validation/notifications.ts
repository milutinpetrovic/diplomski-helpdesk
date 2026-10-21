/**
 * Fajl: src/lib/validation/notifications.ts
 * Svrha: Zod šeme za obaveštenja (UC-08, FZ-12, FZ-13):
 *   - ulaz za GET /api/notifications (?page&pageSize&unreadOnly)
 *   - oblik jednog obaveštenja (NotificationItem) i stranice obaveštenja sa
 *     brojem nepročitanih
 * Obaveštenje NE nosi gotov tekst: interfejs ga sastavlja iz prevoda
 * (notifications.types.<type>) sa imenom aktera i brojem zahteva.
 * Koriste ga: NotificationService, rute u src/app/api/notifications/,
 * Swagger (src/lib/openapi/routes/notifications.ts) i komponente u
 * src/components/notifications/.
 * Povezano sa: tabela notifications (upisuju je RPC funkcije), docs/06 (sekcija Obaveštenja).
 */
import { z } from "zod";

import { paginationSchema, uuidSchema } from "@/lib/validation/common";
import { NOTIFICATION_TYPES } from "@/types/domain";

/** Vrsta obaveštenja (enum notification_type u bazi). */
export const notificationTypeSchema = z
  .enum(NOTIFICATION_TYPES)
  .meta({ description: "Vrsta obaveštenja.", example: "status_changed" });

/** Parametar putanje {id} za POST /api/notifications/{id}/read. */
export const notificationIdParamsSchema = z.object({
  id: uuidSchema.meta({
    description: "ID obaveštenja (uuid).",
    example: "50000000-0000-4000-8000-000000000001",
  }),
});

/**
 * GET /api/notifications — paginacija i ?unreadOnly=true (samo nepročitana).
 * Vrednost unreadOnly je tekst iz adrese ("true" / "false").
 */
export const notificationListQuerySchema = paginationSchema.extend({
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .meta({ description: "true = samo nepročitana obaveštenja.", example: "false" }),
});

/** Jedno obaveštenje u odgovoru API-ja. */
export const notificationItemSchema = z
  .object({
    id: uuidSchema.meta({ example: "50000000-0000-4000-8000-000000000001" }),
    type: notificationTypeSchema,
    ticketId: uuidSchema.nullable().meta({ description: "Zahtev na koji se odnosi." }),
    ticketNumber: z
      .number()
      .int()
      .nullable()
      .meta({ description: "Čitljiv broj zahteva (#1003).", example: 1003 }),
    ticketTitle: z
      .string()
      .nullable()
      .meta({ example: "Ne mogu da se prijavim na portal za zaposlene" }),
    actorName: z.string().nullable().meta({
      description: "Ko je izazvao obaveštenje; null ako nalog više nije vidljiv.",
      example: "Jelena Agentić",
    }),
    isRead: z.boolean().meta({ example: false }),
    createdAt: z.string().meta({ example: "2026-10-21T08:00:00.000Z" }),
  })
  .meta({ id: "NotificationItem", description: "Obaveštenje prijavljenog korisnika." });

/** Odgovor GET /api/notifications: stranica obaveštenja i broj nepročitanih. */
export const notificationListSchema = z
  .object({
    items: z.array(notificationItemSchema),
    page: z.number().int().meta({ example: 1 }),
    pageSize: z.number().int().meta({ example: 20 }),
    total: z
      .number()
      .int()
      .meta({ description: "Ukupan broj obaveštenja (sa filterom).", example: 12 }),
    unreadCount: z
      .number()
      .int()
      .meta({ description: "Broj nepročitanih (bez obzira na filter).", example: 3 }),
  })
  .meta({ id: "NotificationList", description: "Stranica obaveštenja i broj nepročitanih." });

export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationList = z.infer<typeof notificationListSchema>;
