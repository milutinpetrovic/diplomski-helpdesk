/**
 * Fajl: src/app/api/tickets/[id]/history/route.ts
 * Svrha: API ruta za istoriju promena zahteva (audit log, FZ-9, UC-11):
 * ko je, šta i kada promenio.
 * Povezano sa: TicketService.getHistory, tabela ticket_history,
 * Swagger (src/lib/openapi/routes/tickets.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { idParamsSchema } from "@/lib/validation/common";
import { TicketService } from "@/services/tickets/ticket-service";
import { USER_ROLES } from "@/types/domain";

/**
 * GET /api/tickets/{id}/history — stavke od najstarije.
 * Uloge: vlasnik zahteva, agent, admin.
 */
export const GET = withApi(
  { roles: USER_ROLES, params: idParamsSchema },
  async ({ ctx, params }) => {
    return new TicketService(ctx).getHistory(params.id);
  },
);
