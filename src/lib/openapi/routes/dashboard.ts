/**
 * Fajl: src/lib/openapi/routes/dashboard.ts
 * Svrha: Swagger dokumentacija rute kontrolnog panela (tag Dashboard).
 * Povezano sa: src/app/api/dashboard/route.ts, src/lib/validation/dashboard.ts.
 */
import { bearerAuth, errorResponses, jsonResponse, registry } from "@/lib/openapi/registry";
import { dashboardDataSchema } from "@/lib/validation/dashboard";

// GET /api/dashboard — kontrolni panel po ulozi (UC-25).
registry.registerPath({
  method: "get",
  path: "/api/dashboard",
  tags: ["Dashboard"],
  summary: "Kontrolni panel",
  description:
    "Brojevi i kratke liste zahteva za prijavljenog korisnika. Oblik zavisi od uloge " +
    "(polje kind): korisnik dobija svoje zahteve po statusu i šta čeka njega; agent svoje " +
    "zahteve, red nedodeljenih, hitne i svoju prosečnu ocenu; admin ukupne brojeve i " +
    "opterećenje po agentu. Sve se računa pod RLS-om. Uloge: customer, agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: jsonResponse("Podaci kontrolnog panela.", dashboardDataSchema),
    ...errorResponses([401, 403]),
  },
});
