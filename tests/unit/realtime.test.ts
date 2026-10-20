/**
 * Unit testovi: real-time sloj (src/lib/realtime).
 *
 * Proverava nazive kanala i izbor provajdera preko env promenljive
 * NEXT_PUBLIC_REALTIME_PROVIDER (zamenljivost Supabase <-> WebSocket).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { getRealtimeProvider, getRealtimeProviderName, getRealtimePublisher } from "@/lib/realtime";
import { STAFF_CHANNEL, ticketChannel, userChannel } from "@/lib/realtime/events";
import { SupabaseRealtimeProvider } from "@/lib/realtime/supabase-provider";
import { SupabaseRealtimePublisher } from "@/lib/realtime/supabase-publisher";
import type { DbClient } from "@/lib/supabase/types";

const client = {} as DbClient;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("kanali", () => {
  // Nazivi moraju odgovarati dozvolama u bazi (can_access_realtime_topic).
  it("nazivi kanala", () => {
    expect(ticketChannel("abc")).toBe("ticket:abc");
    expect(userChannel("u1")).toBe("user:u1");
    expect(STAFF_CHANNEL).toBe("staff");
  });
});

describe("izbor provajdera", () => {
  it("podrazumevano je supabase", () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_PROVIDER", undefined);
    expect(getRealtimeProviderName()).toBe("supabase");
    expect(getRealtimeProvider(client)).toBeInstanceOf(SupabaseRealtimeProvider);
    expect(getRealtimePublisher(client)).toBeInstanceOf(SupabaseRealtimePublisher);
  });

  // WebSocket provajder se pravi tek na zahtev mentora; do tada jasna greška.
  it("websocket još nije implementiran", () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_PROVIDER", "websocket");
    expect(() => getRealtimeProvider(client)).toThrow(/WebSocket/);
  });

  it("nepoznata vrednost je greška u podešavanjima", () => {
    vi.stubEnv("NEXT_PUBLIC_REALTIME_PROVIDER", "pusher");
    expect(() => getRealtimeProviderName()).toThrow(/pusher/);
  });
});
