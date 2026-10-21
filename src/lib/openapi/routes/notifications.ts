/**
 * Fajl: src/lib/openapi/routes/notifications.ts
 * Svrha: Swagger dokumentacija ruta za obaveštenja (tag Notifications).
 * Povezano sa: src/app/api/notifications/**, src/lib/validation/notifications.ts,
 * docs/06 (sekcija Obaveštenja).
 */
import { bearerAuth, errorResponses, jsonResponse, registry } from "@/lib/openapi/registry";
import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
  notificationListSchema,
} from "@/lib/validation/notifications";

// GET /api/notifications — lista obaveštenja (UC-08).
registry.registerPath({
  method: "get",
  path: "/api/notifications",
  tags: ["Notifications"],
  summary: "Lista obaveštenja",
  description:
    "Obaveštenja prijavljenog korisnika, najnovija prva, sa brojem nepročitanih. " +
    "Obaveštenja pravi baza kad se zahtev kreira, dodeli, promeni status, dobije komentar " +
    "ili ocenu. Tekst ne dolazi iz API-ja: interfejs ga sastavlja iz prevoda po polju type. " +
    "Nova obaveštenja stižu i u realnom vremenu (Supabase Realtime). Uloge: customer, agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: { query: notificationListQuerySchema },
  responses: {
    200: jsonResponse("Stranica obaveštenja i broj nepročitanih.", notificationListSchema),
    ...errorResponses([400, 401, 403]),
  },
});

// POST /api/notifications/{id}/read — jedno obaveštenje je pročitano (UC-08).
registry.registerPath({
  method: "post",
  path: "/api/notifications/{id}/read",
  tags: ["Notifications"],
  summary: "Označi obaveštenje kao pročitano",
  description:
    "Označava jedno sopstveno obaveštenje kao pročitano. Tuđe ili nepostojeće obaveštenje " +
    "daje 404. Uloge: customer, agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: notificationIdParamsSchema },
  responses: {
    204: { description: "Obaveštenje je označeno kao pročitano." },
    ...errorResponses([400, 401, 403, 404]),
  },
});

// POST /api/notifications/read-all — sva obaveštenja su pročitana (UC-08).
registry.registerPath({
  method: "post",
  path: "/api/notifications/read-all",
  tags: ["Notifications"],
  summary: "Označi sva obaveštenja kao pročitana",
  description:
    "Označava sva sopstvena nepročitana obaveštenja kao pročitana. Uloge: customer, agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    204: { description: "Sva obaveštenja su označena kao pročitana." },
    ...errorResponses([401, 403]),
  },
});
