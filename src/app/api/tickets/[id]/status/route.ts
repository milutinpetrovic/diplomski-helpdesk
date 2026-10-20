/**
 * Fajl: src/app/api/tickets/[id]/status/route.ts
 * Svrha: API ruta za promenu statusa zahteva (UC-13, UC-17).
 * Poziva je: stranica zahteva (Faza 5b, preko ApiClient-a), Swagger, Postman.
 * Povezano sa: TicketService.changeStatus, StatusTransitionPolicy, RPC
 * change_ticket_status, Swagger (src/lib/openapi/routes/tickets.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { idParamsSchema } from "@/lib/validation/common";
import { changeStatusSchema } from "@/lib/validation/tickets";
import { TicketService } from "@/services/tickets/ticket-service";
import { USER_ROLES } from "@/types/domain";

/**
 * POST /api/tickets/{id}/status
 * Menja status zahteva ako je prelaz dozvoljen za ulogu prijavljenog korisnika.
 * Ulaz: { status } u telu, ID zahteva u putanji.
 * Vraća: ažuriran zahtev sa novim dozvoljenim akcijama.
 * Uloge: customer (samo svoj zahtev i ograničeni prelazi), agent (dodeljen), admin.
 */
export const POST = withApi(
  { roles: USER_ROLES, params: idParamsSchema, body: changeStatusSchema },
  async ({ ctx, params, body }) => {
    // Servis sadrži svu poslovnu logiku; ruta samo prosleđuje proverene podatke.
    return new TicketService(ctx).changeStatus(params.id, body.status);
  },
);
