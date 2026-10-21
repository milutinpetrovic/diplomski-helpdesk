/**
 * Fajl: src/app/api/admin/users/route.ts
 * Svrha: API ruta za listu svih naloga (UC-21):
 *   - GET /api/admin/users?q&role&isActive&page&pageSize
 * Uloge: samo admin (agent i korisnik dobijaju 403).
 * Povezano sa: UserAdminService.list, userListQuerySchema,
 * Swagger (src/lib/openapi/routes/admin.ts), stranica /admin/users.
 */
import { withApi } from "@/lib/api/with-api";
import { userListQuerySchema } from "@/lib/validation/admin";
import { UserAdminService } from "@/services/admin/user-admin-service";

/** GET /api/admin/users — stranica naloga sa pretragom i filterima. Uloge: admin. */
export const GET = withApi(
  { roles: ["admin"], query: userListQuerySchema },
  async ({ ctx, query }) => {
    return new UserAdminService(ctx).list(query);
  },
);
