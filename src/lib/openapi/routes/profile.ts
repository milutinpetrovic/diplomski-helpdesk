/**
 * Fajl: src/lib/openapi/routes/profile.ts
 * Svrha: Swagger dokumentacija ruta za sopstveni profil (tag Profile):
 * GET /api/me i PATCH /api/me.
 * Povezano sa: src/app/api/me/route.ts, src/lib/validation/profile.ts,
 * docs/06-api-i-stranice.md (sekcija Profil).
 */
import { bearerAuth, errorResponses, registry } from "@/lib/openapi/registry";
import { profileSchema, updateProfileSchema } from "@/lib/validation/profile";

// GET /api/me — sopstveni profil (UC-06).
registry.registerPath({
  method: "get",
  path: "/api/me",
  tags: ["Profile"],
  summary: "Moj profil",
  description: "Vraća profil prijavljenog korisnika. Uloge: customer, agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Profil prijavljenog korisnika.",
      content: { "application/json": { schema: profileSchema } },
    },
    ...errorResponses([401, 403], { 403: "ACCOUNT_DISABLED" }),
  },
});

// PATCH /api/me — izmena imena i jezika (UC-06, UC-07).
registry.registerPath({
  method: "patch",
  path: "/api/me",
  tags: ["Profile"],
  summary: "Izmena mog profila",
  description:
    "Menja ime i/ili jezik prijavljenog korisnika. Ostala polja (uloga, email, aktivnost) nisu " +
    "dozvoljena i vraćaju 400; ulogu menja samo admin. Uloge: customer, agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateProfileSchema,
          example: { fullName: "Ana Jovanović", locale: "en" },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Ažuriran profil.",
      content: { "application/json": { schema: profileSchema } },
    },
    ...errorResponses([400, 401, 403], { 403: "ACCOUNT_DISABLED" }),
  },
});
