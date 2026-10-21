/**
 * Fajl: src/app/api/dashboard/route.ts
 * Svrha: API ruta za kontrolni panel (UC-25): brojevi i kratke liste zahteva,
 * različiti po ulozi (polje kind u odgovoru).
 * Povezano sa: DashboardService, Swagger (src/lib/openapi/routes/dashboard.ts),
 * stranica /dashboard (čita isti servis direktno, na serveru).
 */
import { withApi } from "@/lib/api/with-api";
import { DashboardService } from "@/services/dashboard/dashboard-service";
import { USER_ROLES } from "@/types/domain";

/** GET /api/dashboard — podaci panela za prijavljenog. Uloge: customer, agent, admin. */
export const GET = withApi({ roles: USER_ROLES }, async ({ ctx }) => {
  return new DashboardService(ctx).getForCurrentUser();
});
