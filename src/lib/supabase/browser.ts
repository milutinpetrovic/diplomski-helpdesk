/**
 * Fajl: src/lib/supabase/browser.ts
 * Svrha: Supabase klijent za pregledač (klijentske komponente). Sesiju deli
 * sa serverom preko kolačića (@supabase/ssr).
 * Koriste ga: real-time sloj (SupabaseRealtimeProvider) i prijava preko Google-a
 * (Faza 4). Podatke klijentske komponente NE menjaju direktno: sve izmene idu
 * kroz API rute (ApiClient).
 * Povezano sa: src/lib/supabase/env.ts.
 */
import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { DbClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database";

/** Jedan klijent za celu stranicu (pravi se pri prvom pozivu). */
let browserClient: DbClient | undefined;

/** Vraća Supabase klijent za pregledač (uvek isti primerak). */
export function createBrowserSupabaseClient(): DbClient {
  if (!browserClient) {
    const { url, anonKey } = requireSupabaseEnv();
    browserClient = createBrowserClient<Database>(url, anonKey);
  }
  return browserClient;
}
