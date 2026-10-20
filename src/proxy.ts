/**
 * Fajl: src/proxy.ts
 * Svrha: Next.js proxy (u starijim verzijama middleware.ts) — izvršava se pre
 * svakog zahteva ka stranici ili API ruti. U Fazi 3 samo osvežava Supabase
 * sesiju: ako je pristupni token istekao, Supabase ga obnavlja, a novi
 * kolačići se upisuju u odgovor. Tako Server Components i API rute uvek
 * vide važeću sesiju.
 * U Fazi 4 ovde se dodaju preusmerenja (npr. neprijavljen -> /login).
 * Povezano sa: @supabase/ssr, src/lib/supabase/env.ts.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Proxy funkcija.
 * Ulaz: dolazni zahtev. Vraća: odgovor koji nastavlja ka stranici/ruti, sa
 * eventualno osveženim kolačićima sesije.
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
  await supabase.auth.getUser();

  return response;
}

/**
 * Na kojim putanjama proxy radi: svuda osim statičkih fajlova i slika
 * (za njih sesija nije potrebna, a proxy bi ih samo usporio).
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
