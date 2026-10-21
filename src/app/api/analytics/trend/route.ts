/**
 * Fajl: src/app/api/analytics/trend/route.ts
 * Svrha: API ruta za trend kreiranih i rešenih zahteva (UC-23):
 *   - GET /api/analytics/trend?from&to&bucket=day|week
 * Uloge: samo admin (agent i korisnik dobijaju 403).
 * Povezano sa: AnalyticsService.trend, trendQuerySchema,
 * Swagger (src/lib/openapi/routes/analytics.ts), grafikon TicketsTrendChart.
 */
import { withApi } from "@/lib/api/with-api";
import { trendQuerySchema } from "@/lib/validation/analytics";
import { AnalyticsService } from "@/services/analytics/analytics-service";

/** GET /api/analytics/trend — tačka za svaki dan ili nedelju u periodu. Uloge: admin. */
export const GET = withApi(
  { roles: ["admin"], query: trendQuerySchema },
  async ({ ctx, query }) => {
    return new AnalyticsService(ctx).trend(query, query.bucket);
  },
);
