/**
 * Fajl: src/app/api/tickets/[id]/assign/route.ts
 * Svrha: API ruta za dodelu zahteva: agent preuzima zahtev (UC-16), admin
 * dodeljuje bilo kom članu tima ili oslobađa zahtev (UC-20).
 * Povezano sa: TicketService.assign, TicketAccessPolicy.assertCanAssign,
 * RPC assign_ticket, Swagger (src/lib/openapi/routes/tickets.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { idParamsSchema } from "@/lib/validation/common";
import { assignTicketSchema } from "@/lib/validation/tickets";
import { TicketService } from "@/services/tickets/ticket-service";
import { STAFF_ROLES } from "@/types/domain";

/**
 * POST /api/tickets/{id}/assign
 * Ulaz: { assigneeId } (agent: samo svoj ID; admin: ID člana tima ili null).
 * Vraća: ažuriran zahtev. Uloge: agent, admin.
 */
export const POST = withApi(
  { roles: STAFF_ROLES, params: idParamsSchema, body: assignTicketSchema },
  async ({ ctx, params, body }) => {
    return new TicketService(ctx).assign(params.id, body.assigneeId);
  },
);
