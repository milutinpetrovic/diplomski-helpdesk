/**
 * Fajl: src/lib/realtime/index.ts
 * Svrha: jedino mesto koje bira real-time provajdera, prema env promenljivoj
 * NEXT_PUBLIC_REALTIME_PROVIDER = supabase | websocket.
 * Koriste ga: hook-ovi u pregledaču (getRealtimeProvider) i withApi na serveru
 * (getRealtimePublisher, za ServiceContext).
 * Povezano sa: .env.example, CLAUDE.md, sekcija „Real-time sloj“.
 * Zamena provajdera: dodaje se nova klasa (npr. websocket-provider.ts) i grana
 * ispod; nijedna komponenta se ne menja.
 */
import { SupabaseRealtimeProvider } from "@/lib/realtime/supabase-provider";
import { SupabaseRealtimePublisher } from "@/lib/realtime/supabase-publisher";
import type { RealtimeProvider, RealtimePublisher } from "@/lib/realtime/types";
import type { DbClient } from "@/lib/supabase/types";

/** Podržani provajderi. */
export type RealtimeProviderName = "supabase" | "websocket";

/**
 * Čita izabranog provajdera iz env promenljive (podrazumevano supabase).
 * Nepoznata vrednost je greška u podešavanjima, pa bacamo jasnu poruku.
 */
export function getRealtimeProviderName(): RealtimeProviderName {
  const value = process.env.NEXT_PUBLIC_REALTIME_PROVIDER ?? "supabase";
  if (value === "supabase" || value === "websocket") return value;
  throw new Error(
    `Nepoznat NEXT_PUBLIC_REALTIME_PROVIDER: "${value}" (dozvoljeno: supabase, websocket).`,
  );
}

/** Greška za WebSocket provajdera, koji se pravi samo ako ga mentor zatraži. */
function websocketNotImplemented(): never {
  throw new Error(
    "WebSocket real-time provajder još nije implementiran (pravi se samo na zahtev mentora, vidi CLAUDE.md).",
  );
}

/** Vraća provajdera za slušanje događaja (pregledač). */
export function getRealtimeProvider(client: DbClient): RealtimeProvider {
  return getRealtimeProviderName() === "supabase"
    ? new SupabaseRealtimeProvider(client)
    : websocketNotImplemented();
}

/** Vraća provajdera za slanje događaja (server, servisni sloj). */
export function getRealtimePublisher(client: DbClient): RealtimePublisher {
  return getRealtimeProviderName() === "supabase"
    ? new SupabaseRealtimePublisher(client)
    : websocketNotImplemented();
}
