/**
 * Fajl: src/app/api/me/route.ts
 * Svrha: profil prijavljenog korisnika (UC-06, UC-07):
 *   - GET /api/me   — vraća sopstveni profil
 *   - PATCH /api/me — menja ime i/ili jezik
 * Uloge: customer, agent, admin (svi prijavljeni).
 * Povezano sa: ProfileService, updateProfileSchema, Swagger (routes/profile.ts),
 * stranica /profile i LanguageSwitcher (čuva izabrani jezik u profilu).
 */
import { withApi } from "@/lib/api/with-api";
import { updateProfileSchema } from "@/lib/validation/profile";
import { ProfileService } from "@/services/profile/profile-service";
import { USER_ROLES } from "@/types/domain";

/** GET /api/me — sopstveni profil. */
export const GET = withApi({ roles: USER_ROLES }, async ({ ctx }) => {
  return new ProfileService(ctx).getMe();
});

/** PATCH /api/me — izmena imena i/ili jezika; druga polja (uloga, email) vraćaju 400. */
export const PATCH = withApi(
  { roles: USER_ROLES, body: updateProfileSchema },
  async ({ ctx, body }) => {
    return new ProfileService(ctx).updateMe(body);
  },
);
