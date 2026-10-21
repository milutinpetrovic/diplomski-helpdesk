/**
 * Fajl: src/app/api/admin/categories/[id]/route.ts
 * Svrha: API ruta za izmenu kategorije (UC-22), uključujući deaktivaciju:
 *   - PATCH /api/admin/categories/{id}  { slug?, nameEn?, nameSr?, ..., isActive? }
 * Kategorija se ne briše: deaktivirana ostaje na postojećim zahtevima, ali
 * se ne nudi u formi „Novi zahtev“.
 * Uloge: samo admin.
 * Povezano sa: CategoryService.update, updateCategorySchema,
 * Swagger (src/lib/openapi/routes/categories.ts), stranica /admin/categories.
 */
import { withApi } from "@/lib/api/with-api";
import { categoryIdParamsSchema, updateCategorySchema } from "@/lib/validation/categories";
import { CategoryService } from "@/services/categories/category-service";

/** PATCH /api/admin/categories/{id} — izmena kategorije. Uloge: admin. */
export const PATCH = withApi(
  { roles: ["admin"], params: categoryIdParamsSchema, body: updateCategorySchema },
  async ({ ctx, params, body }) => {
    return new CategoryService(ctx).update(params.id, body);
  },
);
