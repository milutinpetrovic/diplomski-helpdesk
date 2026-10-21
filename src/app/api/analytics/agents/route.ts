/**
 * Fajl: src/app/api/analytics/agents/route.ts
 * Svrha: API ruta za učinak tima po agentu (UC-23):
 *   - GET /api/analytics/agents?from&to
 * Uloge: samo admin (agent i korisnik dobijaju 403).
 * Povezano sa: AnalyticsService.agents, dateRangeQuerySchema,
 * Swagger (src/lib/openapi/routes/analytics.ts), tabela AgentsTable.
 */
import { withApi } from "@/lib/api/with-api";
import { dateRangeQuerySchema } from "@/lib/validation/analytics";
import { AnalyticsService } from "@/services/analytics/analytics-service";

/** GET /api/analytics/agents — dodeljeno, rešeno, vreme i ocena po agentu. Uloge: admin. */
export const GET = withApi(
  { roles: ["admin"], query: dateRangeQuerySchema },
  async ({ ctx, query }) => {
    return new AnalyticsService(ctx).agents(query);
  },
);
