/**
 * Fajl: src/lib/openapi/routes/categories.ts
 * Svrha: Swagger dokumentacija ruta za kategorije (tag Categories):
 *   - GET /api/categories (svi prijavljeni)
 *   - POST /api/admin/categories i PATCH /api/admin/categories/{id} (admin, Faza 8)
 * Povezano sa: src/app/api/categories/route.ts, src/app/api/admin/categories/,
 * src/lib/validation/categories.ts.
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
  categoryIdParamsSchema,
  categoryListQuerySchema,
  categorySchema,
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validation/categories";

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

// POST /api/admin/categories — nova kategorija (UC-22).
registry.registerPath({
  method: "post",
  path: "/api/admin/categories",
  tags: ["Categories"],
  summary: "Nova kategorija",
  description:
    "Dodaje aktivnu kategoriju sa nazivom i opisom na srpskom i engleskom. Oznaka " +
    "(slug) mora biti jedinstvena (409 CATEGORY_SLUG_TAKEN). Uloge: admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: jsonBody(createCategorySchema, {
      slug: "network",
      nameEn: "Network",
      nameSr: "Mreža",
      descriptionEn: "Wi-Fi, VPN and internet access.",
      descriptionSr: "Wi-Fi, VPN i pristup internetu.",
      sortOrder: 6,
    }),
  },
  responses: {
    201: jsonResponse("Nova kategorija.", categorySchema),
    ...errorResponses([400, 401, 403, 409], { 409: "CATEGORY_SLUG_TAKEN" }),
  },
});

// PATCH /api/admin/categories/{id} — izmena ili (de)aktivacija kategorije (UC-22).
registry.registerPath({
  method: "patch",
  path: "/api/admin/categories/{id}",
  tags: ["Categories"],
  summary: "Izmena kategorije",
  description:
    "Menja naziv, opis, oznaku, redosled ili aktivnost kategorije. Deaktivirana " +
    "kategorija ostaje na postojećim zahtevima, ali se ne nudi pri kreiranju novih. " +
    "Uloge: admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: categoryIdParamsSchema,
    body: jsonBody(updateCategorySchema, { isActive: false }),
  },
  responses: {
    200: jsonResponse("Ažurirana kategorija.", categorySchema),
    ...errorResponses([400, 401, 403, 404, 409], { 409: "CATEGORY_SLUG_TAKEN" }),
  },
});
