/**
 * Fajl: src/proxy.ts
 * Svrha: Next.js proxy (u starijim verzijama middleware.ts) — izvršava se pre
 * svakog zahteva ka stranici ili API ruti. Radi dve stvari:
 *   1. osvežava Supabase sesiju: ako je pristupni token istekao, Supabase ga
 *      obnavlja, a novi kolačići se upisuju u odgovor (Server Components i API
 *      rute uvek vide važeću sesiju)
 *   2. preusmerava stranice po tome da li je korisnik prijavljen (gost sa
 *      /dashboard na /login, prijavljen sa /login na /dashboard...)
 * Uloga (npr. samo admin na /admin) se NE proverava ovde, nego na serveru u
 * layout.tsx tih stranica i u API rutama.
 * Povezano sa: @supabase/ssr, src/lib/supabase/env.ts, src/lib/auth/route-access.ts (pravila).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getAccessRedirect } from "@/lib/auth/route-access";
import { readSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Proxy funkcija.
 * Ulaz: dolazni zahtev. Vraća: odgovor koji nastavlja ka stranici/ruti, ili
 * preusmerenje; u oba slučaja sa eventualno osveženim kolačićima sesije.
 */
export async function proxy(request: NextRequest) {
  // Korak 1: bez Supabase podešavanja (npr. aplikacija bez baze) nema šta da se osvežava.
  const env = readSupabaseEnv();
  if (!env) return NextResponse.next();

  // Korak 2: odgovor koji nastavlja dalje; u njega se upisuju novi kolačići.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Novi kolačići idu i u zahtev (za ostatak obrade) i u odgovor (za pregledač).
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Korak 3: provera korisnika kod Supabase Auth-a; usput se token osvežava ako je istekao.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Korak 4: API rute same proveravaju prijavu (401 u JSON-u), pa se ne preusmeravaju.
  if (request.nextUrl.pathname.startsWith("/api/")) return response;

  // Korak 5: preusmerenje stranice po pravilima iz route-access.ts.
  const target = getAccessRedirect(request.nextUrl, user !== null);
  if (!target) return response;
  const redirect = NextResponse.redirect(new URL(target, request.url));
  // Osveženi kolačići sesije moraju stići i uz preusmerenje.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

/**
 * Na kojim putanjama proxy radi: svuda osim statičkih fajlova i slika
 * (za njih sesija nije potrebna, a proxy bi ih samo usporio).
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
