/**
 * Fajl: src/app/api/auth/password/forgot/route.ts
 * Svrha: POST /api/auth/password/forgot — slanje linka za reset lozinke (UC-04).
 * Uloge: gost (javna ruta).
 * Odgovor: uvek 204 (i kad nalog ne postoji), da se ne bi otkrilo koji emailovi
 * imaju nalog. Izuzetak: 429 RATE_LIMITED kad ima previše zahteva.
 * Povezano sa: AuthService.requestPasswordReset, šablon emaila supabase/templates/recovery.html.
 */
import { withApi } from "@/lib/api/with-api";
import { getSiteUrl } from "@/lib/site-url";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { AuthService } from "@/services/auth/auth-service";

/** Zaboravljena lozinka: provera emaila -> Supabase šalje link -> 204. */
export const POST = withApi(
  { roles: "public", body: forgotPasswordSchema },
  async ({ request, body }) => {
    const service = new AuthService(await createServerSupabaseClient(), getSiteUrl(request));
    await service.requestPasswordReset(body.email);
  },
);
