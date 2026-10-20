/**
 * Fajl: src/lib/supabase/server.ts
 * Svrha: pravljenje Supabase klijenta na serveru (deo SupabaseClientFactory iz
 * docs/03). Dva načina prijave:
 *   1. kolačić sesije — kad API poziva sama aplikacija (pregledač)
 *   2. zaglavlje `Authorization: Bearer <JWT>` — kad API poziva Swagger ili Postman
 * Koriste ga: AuthGuard (src/lib/auth/auth-guard.ts), Server Components koje čitaju podatke.
 * Povezano sa: @supabase/ssr (sesija u kolačićima), src/lib/supabase/env.ts.
 * Važno: ovde se NIKAD ne koristi service_role ključ; svi upiti idu u ime
 * prijavljenog korisnika, pa važe RLS politike iz baze.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { DbClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database";

/**
 * Klijent koji sesiju čita iz kolačića zahteva (aplikacija u pregledaču).
 * Kad Supabase osveži token, novi kolačići se upisuju u odgovor; u Server
 * Component-i upis nije dozvoljen, pa se tada preskače (osvežavanje radi proxy.ts).
 */
export async function createServerSupabaseClient(): Promise<DbClient> {
  // Kolačići se čitaju PRVI: tako Next.js pri build-u zna da je stranica dinamička
  // (zavisi od zahteva) i ne pokušava da je unapred napravi bez Supabase podešavanja.
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      // Čitanje svih kolačića zahteva (Supabase traži svoje kolačiće sesije).
      getAll() {
        return cookieStore.getAll();
      },
      // Upis osveženih kolačića; u Server Component-i baca grešku, koju ignorišemo.
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component ne sme da menja kolačiće; proxy.ts osvežava sesiju.
        }
      },
    },
  });
}

/**
 * Klijent za poziv sa `Authorization: Bearer <JWT>` (Swagger "Authorize", Postman).
 * Token se šalje uz svaki upit, pa baza zna ko je korisnik (auth.uid()).
 */
export function createClientFromBearer(accessToken: string): DbClient {
  const { url, anonKey } = requireSupabaseEnv();
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Izvlači token iz zaglavlja `Authorization: Bearer <token>`.
 * Vraća: token ili null ako zaglavlje ne postoji ili nije u tom obliku.
 */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  return match?.[1] ?? null;
}
