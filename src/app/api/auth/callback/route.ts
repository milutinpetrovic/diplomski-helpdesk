/**
 * Fajl: src/app/api/auth/callback/route.ts
 * Svrha: GET /api/auth/callback — povratak u aplikaciju posle:
 *   - Google prijave (UC-03): stiže ?code=...
 *   - klika na link iz emaila: potvrda naloga (UC-01) ili reset lozinke (UC-04):
 *     stižu ?token_hash=...&type=email|recovery
 * Uloge: gost (javna ruta). Uvek odgovara preusmerenjem (302), nikad JSON-om:
 *   - uspeh -> na ?next (npr. /dashboard ili /reset-password), sa kolačićima sesije
 *   - greška -> na /login?error=<KOD>, gde se prikazuje prevedena poruka
 * Povezano sa: AuthService.completeCallback, šabloni emailova (supabase/templates),
 * docs/05 SD-02 i SD-03.
 */
import { NextResponse } from "next/server";

import { withApi } from "@/lib/api/with-api";
import { AppError } from "@/lib/errors/app-error";
import { readLocaleCookie, writeLocaleCookie } from "@/lib/i18n/locale-cookie-server";
import { getSiteUrl } from "@/lib/site-url";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { callbackQuerySchema, safeNextPath } from "@/lib/validation/auth";
import { AuthService } from "@/services/auth/auth-service";

/** Callback: zamena koda/tokena za sesiju, pa preusmerenje. */
export const GET = withApi(
  { roles: "public", query: callbackQuerySchema },
  async ({ request, query }) => {
    try {
      // Korak 1: sesija iz koda ili tokena; provera da je nalog aktivan.
      const service = new AuthService(await createServerSupabaseClient(), getSiteUrl(request));
      const profile = await service.completeCallback(query, await readLocaleCookie());

      // Korak 2: jezik iz profila i preusmerenje na traženu stranicu.
      await writeLocaleCookie(profile.locale);
      return NextResponse.redirect(new URL(safeNextPath(query.next), request.url), 302);
    } catch (error) {
      // Korak 3: greška -> stranica za prijavu sa kodom greške (prevodi se na stranici).
      const code = error instanceof AppError ? error.code : "AUTH_CALLBACK_FAILED";
      if (!(error instanceof AppError)) console.error("[auth] callback:", error);
      const target = new URL("/login", request.url);
      target.searchParams.set("error", code === "INTERNAL_ERROR" ? "AUTH_CALLBACK_FAILED" : code);
      return NextResponse.redirect(target, 302);
    }
  },
);
