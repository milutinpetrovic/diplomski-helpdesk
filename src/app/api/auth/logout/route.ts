/**
 * Fajl: src/app/api/auth/logout/route.ts
 * Svrha: POST /api/auth/logout — odjava (UC-05).
 * Uloge: customer, agent, admin (svi prijavljeni).
 * Odgovor: 204; kolačići sesije se brišu, a sesija se poništava i kod Supabase-a.
 * Povezano sa: AuthService.logout, dugme „Odjava“ (LogoutButton), Swagger (routes/auth.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { getSiteUrl } from "@/lib/site-url";
import { readBearerToken } from "@/lib/supabase/server";
import { AuthService } from "@/services/auth/auth-service";
import { USER_ROLES } from "@/types/domain";

/** Odjava: withApi proverava da je korisnik prijavljen, servis poništava sesiju. */
export const POST = withApi({ roles: USER_ROLES }, async ({ request, ctx }) => {
  await new AuthService(ctx.db, getSiteUrl(request)).logout(readBearerToken(request));
});
