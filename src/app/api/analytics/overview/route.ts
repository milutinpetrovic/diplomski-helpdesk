/**
 * Fajl: src/app/api/analytics/overview/route.ts
 * Svrha: API ruta za KPI kartice analitike (UC-23):
 *   - GET /api/analytics/overview?from&to
 * Uloge: samo admin (agent i korisnik dobijaju 403).
 * Povezano sa: AnalyticsService.overview, dateRangeQuerySchema,
 * Swagger (src/lib/openapi/routes/analytics.ts), stranica /analytics.
 */
import { withApi } from "@/lib/api/with-api";
import { dateRangeQuerySchema } from "@/lib/validation/analytics";
import { AnalyticsService } from "@/services/analytics/analytics-service";

/** GET /api/analytics/overview — KPI brojevi i CSAT za period. Uloge: admin. */
export const GET = withApi(
  { roles: ["admin"], query: dateRangeQuerySchema },
  async ({ ctx, query }) => {
    return new AnalyticsService(ctx).overview(query);
  },
);
