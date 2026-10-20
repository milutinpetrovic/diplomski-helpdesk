/**
 * Fajl: src/lib/openapi/routes/ratings.ts
 * Svrha: Swagger dokumentacija rute za ocenu zadovoljstva (tag Ratings).
 * Povezano sa: src/app/api/tickets/[id]/rating/route.ts,
 * src/lib/validation/ratings.ts, docs/06 (sekcija Ocene).
 */
import {
  bearerAuth,
  errorResponses,
  jsonBody,
  jsonResponse,
  registry,
} from "@/lib/openapi/registry";
import { idParamsSchema } from "@/lib/validation/common";
import { rateTicketSchema, ticketRatingSchema } from "@/lib/validation/ratings";

// POST /api/tickets/{id}/rating — CSAT ocena (UC-14).
registry.registerPath({
  method: "post",
  path: "/api/tickets/{id}/rating",
  tags: ["Ratings"],
  summary: "Ocena rešenog zahteva",
  description:
    "Vlasnik ocenjuje rešen ili zatvoren zahtev sa 1–5 zvezdica i opcionim komentarom, " +
    "najviše jednom. Dodeljeni agent dobija obaveštenje. Uloga: customer.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParamsSchema,
    body: jsonBody(rateTicketSchema, { score: 5, comment: "Brzo i ljubazno, hvala!" }),
  },
  responses: {
    201: jsonResponse("Sačuvana ocena.", ticketRatingSchema),
    ...errorResponses([400, 401, 403, 404, 409], {
      404: "TICKET_NOT_FOUND",
      409: "TICKET_NOT_RESOLVED",
    }),
  },
});
