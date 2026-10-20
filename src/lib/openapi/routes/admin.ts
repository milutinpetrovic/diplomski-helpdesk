/**
 * Fajl: src/lib/openapi/routes/admin.ts
 * Svrha: Swagger dokumentacija ruta za administraciju i tim podrške (tag Admin).
 * U Fazi 5 samo GET /api/agents; upravljanje korisnicima dolazi u Fazi 8.
 * Povezano sa: src/app/api/agents/route.ts, src/lib/validation/admin.ts.
 */
import { z } from "zod";

import { bearerAuth, errorResponses, jsonResponse, registry } from "@/lib/openapi/registry";
import { agentSummarySchema } from "@/lib/validation/admin";

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
