/**
 * Fajl: src/app/api/tickets/[id]/route.ts
 * Svrha: jedan zahtev:
 *   - GET /api/tickets/{id}   — detalji sa dozvoljenim akcijama (permissions), UC-11
 *   - PATCH /api/tickets/{id} — izmena naslova, opisa, kategorije ili prioriteta
 * Povezano sa: TicketService (getById, update), TicketAccessPolicy,
 * Swagger (src/lib/openapi/routes/tickets.ts), docs/06 (sekcija Zahtevi).
 */
import { withApi } from "@/lib/api/with-api";
import { idParamsSchema } from "@/lib/validation/common";
import { updateTicketSchema } from "@/lib/validation/tickets";
import { TicketService } from "@/services/tickets/ticket-service";
import { USER_ROLES } from "@/types/domain";

/**
 * GET /api/tickets/{id} — detalji zahteva.
 * Uloge: vlasnik zahteva, agent, admin; tuđ zahtev vraća 404 TICKET_NOT_FOUND.
 */
export const GET = withApi(
  { roles: USER_ROLES, params: idParamsSchema },
  async ({ ctx, params }) => {
    return new TicketService(ctx).getById(params.id);
  },
);

/**
 * PATCH /api/tickets/{id} — izmena zahteva.
 * Uloge: korisnik (svoj otvoren zahtev, samo naslov i opis), agent
 * (dodeljen zahtev), admin (svaki zahtev osim zatvorenog).
 */
export const PATCH = withApi(
  { roles: USER_ROLES, params: idParamsSchema, body: updateTicketSchema },
  async ({ ctx, params, body }) => {
    return new TicketService(ctx).update(params.id, body);
  },
);
