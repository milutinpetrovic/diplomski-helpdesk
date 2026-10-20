/**
 * Fajl: src/lib/supabase/env.ts
 * Svrha: čita adresu Supabase projekta i javni (anon) ključ iz env promenljivih.
 * Koriste ga: Supabase klijenti (server.ts, browser.ts) i proxy.ts.
 * Povezano sa: .env.example (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
 * Lokalno vrednosti ispisuje `pnpm db:start` (API URL i anon key).
 */

/** Adresa i javni ključ Supabase projekta. */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/**
 * Vraća Supabase podešavanja ili null ako nisu zadata (npr. build u CI-ju bez baze).
 * NEXT_PUBLIC_* promenljive se moraju čitati punim imenom da bi ih Next.js
 * ugradio i u kod za pregledač.
 */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/** Isto kao readSupabaseEnv, ali baca jasnu grešku ako podešavanja nedostaju. */
export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) {
    throw new Error(
      "Nedostaju NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY (vidi .env.example).",
    );
  }
  return env;
}
