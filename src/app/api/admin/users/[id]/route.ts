/**
 * Fajl: src/app/api/admin/users/[id]/route.ts
 * Svrha: API ruta za izmenu uloge i aktivnosti naloga (UC-21, FZ-3):
 *   - PATCH /api/admin/users/{id}  { role?, isActive? }
 * Admin ne može da menja sopstveni nalog (409 CANNOT_MODIFY_SELF). Kad agent
 * izgubi ulogu ili bude deaktiviran, njegovi nerešeni zahtevi se vraćaju u red.
 * Uloge: samo admin.
 * Povezano sa: UserAdminService.update (RPC admin_update_user),
 * Swagger (src/lib/openapi/routes/admin.ts), stranica /admin/users.
 */
import { withApi } from "@/lib/api/with-api";
import { adminUpdateUserSchema, userIdParamsSchema } from "@/lib/validation/admin";
import { UserAdminService } from "@/services/admin/user-admin-service";

/** PATCH /api/admin/users/{id} — nova uloga i/ili aktivnost. Uloge: admin. */
export const PATCH = withApi(
  { roles: ["admin"], params: userIdParamsSchema, body: adminUpdateUserSchema },
  async ({ ctx, params, body }) => {
    return new UserAdminService(ctx).update(params.id, body);
  },
);
