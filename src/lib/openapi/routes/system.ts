/**
 * Fajl: src/lib/openapi/routes/system.ts
 * Svrha: Swagger dokumentacija sistemskih ruta (tag System): sama OpenAPI
 * specifikacija. Ostale grupe ruta (Auth, Tickets, Comments, Notifications,
 * Analytics, Admin) dobijaju svoje fajlove u ovom folderu u fazama u kojima
 * se prave.
 * Povezano sa: src/app/api/openapi/route.ts.
 */
import { z } from "zod";

import { errorResponses, registry } from "@/lib/openapi/registry";

// GET /api/openapi — OpenAPI 3 dokument (ovo što Swagger UI prikazuje).
registry.registerPath({
  method: "get",
  path: "/api/openapi",
  tags: ["System"],
  summary: "OpenAPI specifikacija",
  description:
    "Vraća OpenAPI 3 dokument sa svim API rutama aplikacije. Koristi ga Swagger UI (/api-docs); " +
    "isti JSON se može uvesti u Postman. Uloge: svi (bez prijave). " +
    "Ako je SWAGGER_ENABLED=false, vraća 404.",
  responses: {
    200: {
      description: "OpenAPI dokument.",
      content: {
        "application/json": {
          schema: z
            .object({
              openapi: z.string().meta({ example: "3.0.3" }),
              info: z.object({
                title: z.string().meta({ example: "Tehnička podrška — API" }),
                version: z.string().meta({ example: "0.4.0" }),
              }),
              paths: z.object({}).meta({ description: "Sve API rute aplikacije." }),
            })
            .meta({ description: "OpenAPI 3 dokument (skraćen prikaz)." }),
        },
      },
    },
    ...errorResponses([404]),
  },
});
