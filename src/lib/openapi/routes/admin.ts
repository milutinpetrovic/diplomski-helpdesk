/**
 * Fajl: src/lib/openapi/routes/admin.ts
 * Svrha: Swagger dokumentacija ruta za administraciju i tim podrške (tag Admin):
 *   - GET /api/agents (spisak tima za dodelu, Faza 5)
 *   - GET /api/admin/users i PATCH /api/admin/users/{id} (upravljanje
 *     nalozima i ulogama, Faza 8)
 * Povezano sa: src/app/api/agents/route.ts, src/app/api/admin/users/,
 * src/lib/validation/admin.ts.
 */
import { z } from "zod";

import {
  bearerAuth,
  errorResponses,
  jsonBody,
  jsonResponse,
  registry,
} from "@/lib/openapi/registry";
import {
  adminUpdateUserSchema,
  adminUserListSchema,
  adminUserSchema,
  agentSummarySchema,
  userIdParamsSchema,
  userListQuerySchema,
} from "@/lib/validation/admin";

// GET /api/agents — spisak članova tima za dodelu (UC-20).
registry.registerPath({
  method: "get",
  path: "/api/agents",
  tags: ["Admin"],
  summary: "Agenti za dodelu",
  description:
    "Aktivni agenti i admini, po imenu, sa brojem dodeljenih zahteva koji nisu rešeni ni " +
    "zatvoreni (za padajuću listu „Dodeli agentu“). Uloge: agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: jsonResponse("Članovi tima podrške.", z.array(agentSummarySchema)),
    ...errorResponses([401, 403]),
  },
});

// GET /api/admin/users — lista svih naloga (UC-21).
registry.registerPath({
  method: "get",
  path: "/api/admin/users",
  tags: ["Admin"],
  summary: "Lista naloga",
  description:
    "Svi nalozi po imenu, sa pretragom po imenu ili emailu (q), filterima uloge i " +
    "aktivnosti i paginacijom. Uz svaki nalog i broj dodeljenih nerešenih zahteva. " +
    "Uloge: admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: { query: userListQuerySchema },
  responses: {
    200: jsonResponse("Stranica naloga.", adminUserListSchema),
    ...errorResponses([400, 401, 403]),
  },
});

// PATCH /api/admin/users/{id} — izmena uloge i aktivnosti naloga (UC-21, FZ-3).
registry.registerPath({
  method: "patch",
  path: "/api/admin/users/{id}",
  tags: ["Admin"],
  summary: "Izmena uloge ili aktivnosti naloga",
  description:
    "Menja ulogu (customer, agent, admin) i/ili aktivnost naloga. Admin ne može da " +
    "menja sopstveni nalog (409 CANNOT_MODIFY_SELF). Kad agent ili admin izgubi ulogu " +
    "tima ili bude deaktiviran, njegovi nerešeni zahtevi se vraćaju u red za " +
    "preuzimanje (upisuje se u istoriju zahteva). Deaktiviran nalog dobija 403 " +
    "ACCOUNT_DISABLED na svakom pozivu. Uloge: admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: userIdParamsSchema, body: jsonBody(adminUpdateUserSchema, { role: "agent" }) },
  responses: {
    200: jsonResponse("Ažuriran nalog.", adminUserSchema),
    ...errorResponses([400, 401, 403, 404, 409], { 409: "CANNOT_MODIFY_SELF" }),
  },
});
