/**
 * Fajl: src/lib/openapi/routes/categories.ts
 * Svrha: Swagger dokumentacija ruta za kategorije (tag Categories).
 * Rute za dodavanje i izmenu kategorija (admin) dolaze u Fazi 8.
 * Povezano sa: src/app/api/categories/route.ts, src/lib/validation/categories.ts.
 */
import { z } from "zod";

import { bearerAuth, errorResponses, jsonResponse, registry } from "@/lib/openapi/registry";
import { categoryListQuerySchema, categorySchema } from "@/lib/validation/categories";

// GET /api/categories — lista kategorija (UC-09, UC-22).
registry.registerPath({
  method: "get",
  path: "/api/categories",
  tags: ["Categories"],
  summary: "Kategorije zahteva",
  description:
    "Aktivne kategorije redom za prikaz (nazivi na srpskom i engleskom). Sa " +
    "includeInactive=true i neaktivne, samo za admina (ostali dobijaju 403). " +
    "Uloge: customer, agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: { query: categoryListQuerySchema },
  responses: {
    200: jsonResponse("Kategorije.", z.array(categorySchema)),
    ...errorResponses([400, 401, 403]),
  },
});
