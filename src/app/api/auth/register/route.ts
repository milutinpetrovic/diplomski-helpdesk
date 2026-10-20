/**
 * Fajl: src/app/api/auth/register/route.ts
 * Svrha: POST /api/auth/register — registracija novog korisnika (UC-01).
 * Uloge: gost (javna ruta). Nalog uvek dobija ulogu customer.
 * Odgovor: 201 bez tela; korisnik zatim dobija email sa linkom za potvrdu.
 * Povezano sa: AuthService.register, registerSchema, Swagger (routes/auth.ts), docs/05 SD-02.
 */
import { withApi } from "@/lib/api/with-api";
import { localeFromRequest } from "@/lib/errors/handler";
import { getSiteUrl } from "@/lib/site-url";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { registerSchema } from "@/lib/validation/auth";
import { AuthService } from "@/services/auth/auth-service";

/** Registracija: provera ulaza (withApi) -> nalog u Supabase-u -> 201. */
export const POST = withApi(
  { roles: "public", body: registerSchema },
  async ({ request, body }) => {
    // Jezik interfejsa (Accept-Language koji šalje ApiClient) se upisuje u profil.
    const service = new AuthService(await createServerSupabaseClient(), getSiteUrl(request));
    await service.register(body, localeFromRequest(request));
    return new Response(null, { status: 201 });
  },
);
