/**
 * Fajl: src/app/api/categories/route.ts
 * Svrha: API ruta za listu kategorija zahteva (forma „Novi zahtev“, filteri;
 * UC-09, UC-22).
 * Povezano sa: CategoryService, categoryListQuerySchema,
 * Swagger (src/lib/openapi/routes/categories.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { categoryListQuerySchema } from "@/lib/validation/categories";
import { CategoryService } from "@/services/categories/category-service";
import { USER_ROLES } from "@/types/domain";

/**
 * GET /api/categories — aktivne kategorije; ?includeInactive=true i
 * neaktivne (samo admin, ostali dobijaju 403).
 * Uloge: customer, agent, admin.
 */
export const GET = withApi(
  { roles: USER_ROLES, query: categoryListQuerySchema },
  async ({ ctx, query }) => {
    const service = new CategoryService(ctx);
    return query.includeInactive === "true" ? service.listAll() : service.listActive();
  },
);
