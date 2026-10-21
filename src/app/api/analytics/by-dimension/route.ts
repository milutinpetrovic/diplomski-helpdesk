/**
 * Fajl: src/app/api/analytics/by-dimension/route.ts
 * Svrha: API ruta za raspodelu zahteva (UC-23):
 *   - GET /api/analytics/by-dimension?from&to&dimension=status|category|priority
 * Uloge: samo admin (agent i korisnik dobijaju 403).
 * Povezano sa: AnalyticsService.byDimension, byDimensionQuerySchema,
 * Swagger (src/lib/openapi/routes/analytics.ts), grafikon ByDimensionChart.
 */
import { withApi } from "@/lib/api/with-api";
import { byDimensionQuerySchema } from "@/lib/validation/analytics";
import { AnalyticsService } from "@/services/analytics/analytics-service";

/** GET /api/analytics/by-dimension — broj zahteva po grupi. Uloge: admin. */
export const GET = withApi(
  { roles: ["admin"], query: byDimensionQuerySchema },
  async ({ ctx, query }) => {
    return new AnalyticsService(ctx).byDimension(query, query.dimension);
  },
);
