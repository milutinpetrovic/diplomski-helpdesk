/**
 * Fajl: src/app/api/admin/categories/route.ts
 * Svrha: API ruta za dodavanje kategorije zahteva (UC-22):
 *   - POST /api/admin/categories  { slug, nameEn, nameSr, descriptionEn?, descriptionSr?, sortOrder? }
 * Lista svih kategorija (i neaktivnih) je GET /api/categories?includeInactive=true.
 * Uloge: samo admin.
 * Povezano sa: CategoryService.create, createCategorySchema,
 * Swagger (src/lib/openapi/routes/categories.ts), stranica /admin/categories.
 */
import { withApi } from "@/lib/api/with-api";
import { createCategorySchema } from "@/lib/validation/categories";
import { CategoryService } from "@/services/categories/category-service";

/** POST /api/admin/categories — nova kategorija (201). Uloge: admin. */
export const POST = withApi(
  { roles: ["admin"], body: createCategorySchema, successStatus: 201 },
  async ({ ctx, body }) => {
    return new CategoryService(ctx).create(body);
  },
);
