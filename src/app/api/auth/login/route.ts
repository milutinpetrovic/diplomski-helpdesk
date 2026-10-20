/**
 * Fajl: src/app/api/auth/login/route.ts
 * Svrha: POST /api/auth/login — prijava emailom i lozinkom (UC-02).
 * Uloge: gost (javna ruta).
 * Odgovor: 200 { profile, session: { accessToken, expiresAt } } + kolačići sesije.
 * Token iz odgovora služi za Swagger („Authorize“) i Postman.
 * Povezano sa: AuthService.login, loginSchema, Swagger (routes/auth.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { readLocaleCookie, writeLocaleCookie } from "@/lib/i18n/locale-cookie-server";
import { getSiteUrl } from "@/lib/site-url";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";
import { AuthService } from "@/services/auth/auth-service";

/** Prijava: provera ulaza -> Supabase Auth -> provera profila -> jezik u kolačić. */
export const POST = withApi({ roles: "public", body: loginSchema }, async ({ request, body }) => {
  // Korak 1: prijava (kolačići sesije se upisuju u odgovor).
  const service = new AuthService(await createServerSupabaseClient(), getSiteUrl(request));
  const result = await service.login(body, await readLocaleCookie());

  // Korak 2: interfejs posle prijave koristi jezik iz profila.
  await writeLocaleCookie(result.profile.locale);
  return result;
});
