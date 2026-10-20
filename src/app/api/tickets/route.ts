/**
 * Fajl: src/app/api/tickets/route.ts
 * Svrha: zahtevi (tiketi) — lista i kreiranje:
 *   - GET /api/tickets  — lista sa filterima, pretragom, sortiranjem i paginacijom
 *                         (UC-10, UC-15, UC-19); korisnik dobija samo svoje
 *   - POST /api/tickets — novi zahtev (UC-09), samo korisnik
 * Povezano sa: TicketService, ticketListQuerySchema, createTicketSchema,
 * Swagger (src/lib/openapi/routes/tickets.ts), docs/06 (sekcija Zahtevi).
 */
import { withApi } from "@/lib/api/with-api";
import { createTicketSchema, ticketListQuerySchema } from "@/lib/validation/tickets";
import { TicketService } from "@/services/tickets/ticket-service";
import { USER_ROLES } from "@/types/domain";

/** GET /api/tickets — stranica zahteva. Uloge: customer, agent, admin. */
export const GET = withApi(
  { roles: USER_ROLES, query: ticketListQuerySchema },
  async ({ ctx, query }) => {
    return new TicketService(ctx).list(query);
  },
);

/** POST /api/tickets — novi zahtev (201). Uloga: customer. */
export const POST = withApi(
  { roles: ["customer"], body: createTicketSchema, successStatus: 201 },
  async ({ ctx, body }) => {
    return new TicketService(ctx).create(body);
  },
);
