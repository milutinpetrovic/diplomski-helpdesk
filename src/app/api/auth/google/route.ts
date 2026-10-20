/**
 * Fajl: src/app/api/auth/google/route.ts
 * Svrha: GET /api/auth/google — početak prijave Google nalogom (UC-03).
 * Uloge: gost (javna ruta). Dugme „Nastavi sa Google nalogom“ je običan link na ovu rutu.
 * Odgovor: 302 preusmerenje na Google stranicu za prijavu (preko Supabase Auth-a).
 * Povezano sa: AuthService.getGoogleOAuthUrl, GET /api/auth/callback, docs/05 SD-03.
 */
import { NextResponse } from "next/server";

import { withApi } from "@/lib/api/with-api";
import { getSiteUrl } from "@/lib/site-url";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { googleQuerySchema, safeNextPath } from "@/lib/validation/auth";
import { AuthService } from "@/services/auth/auth-service";

/** Google prijava: pravi URL i preusmerava pregledač; ?next= je putanja posle prijave. */
export const GET = withApi(
  { roles: "public", query: googleQuerySchema },
  async ({ request, query }) => {
    const service = new AuthService(await createServerSupabaseClient(), getSiteUrl(request));
    const url = await service.getGoogleOAuthUrl(safeNextPath(query.next));
    return NextResponse.redirect(url, 302);
  },
);
