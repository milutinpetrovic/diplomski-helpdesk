/**
 * Fajl: src/app/api/auth/password/reset/route.ts
 * Svrha: POST /api/auth/password/reset — postavljanje nove lozinke (UC-04).
 * Uloge: customer, agent, admin — korisnik je prijavljen sesijom iz linka za
 * reset (ili je već prijavljen i menja lozinku na stranici /profile).
 * Odgovor: 204.
 * Povezano sa: AuthService.resetPassword, stranice /reset-password i /profile.
 */
import { withApi } from "@/lib/api/with-api";
import { getSiteUrl } from "@/lib/site-url";
import { readBearerToken } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { AuthService } from "@/services/auth/auth-service";
import { USER_ROLES } from "@/types/domain";

/** Nova lozinka: withApi proverava sesiju i pravila lozinke, servis je upisuje. */
export const POST = withApi(
  { roles: USER_ROLES, body: resetPasswordSchema },
  async ({ request, ctx, body }) => {
    const service = new AuthService(ctx.db, getSiteUrl(request));
    await service.resetPassword(body.password, readBearerToken(request));
  },
);
