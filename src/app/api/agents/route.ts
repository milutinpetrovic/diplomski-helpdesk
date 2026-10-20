/**
 * Fajl: src/app/api/agents/route.ts
 * Svrha: API ruta za spisak aktivnih agenata i admina (padajuća lista
 * „Dodeli agentu“, UC-20), sa brojem nerešenih dodeljenih zahteva.
 * Povezano sa: UserAdminService.listAgents, Swagger (src/lib/openapi/routes/admin.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { UserAdminService } from "@/services/admin/user-admin-service";
import { STAFF_ROLES } from "@/types/domain";

/** GET /api/agents — članovi tima podrške. Uloge: agent, admin. */
export const GET = withApi({ roles: STAFF_ROLES }, async ({ ctx }) => {
  return new UserAdminService(ctx).listAgents();
});
