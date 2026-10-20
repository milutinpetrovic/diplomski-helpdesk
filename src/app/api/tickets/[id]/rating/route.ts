/**
 * Fajl: src/app/api/tickets/[id]/rating/route.ts
 * Svrha: API ruta za ocenu zadovoljstva (CSAT, FZ-16, UC-14).
 * Povezano sa: RatingService, rateTicketSchema, RPC rate_ticket,
 * Swagger (src/lib/openapi/routes/ratings.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { idParamsSchema } from "@/lib/validation/common";
import { rateTicketSchema } from "@/lib/validation/ratings";
import { RatingService } from "@/services/ratings/rating-service";

/**
 * POST /api/tickets/{id}/rating — ocena 1–5 rešenog zahteva (201), jednom.
 * Uloga: customer (vlasnik zahteva).
 */
export const POST = withApi(
  { roles: ["customer"], params: idParamsSchema, body: rateTicketSchema, successStatus: 201 },
  async ({ ctx, params, body }) => {
    return new RatingService(ctx).rate(params.id, body);
  },
);
