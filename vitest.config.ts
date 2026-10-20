/**
 * Konfiguracija Vitest-a (testovi).
 *
 * Trenutno postoje samo integracioni testovi baze (tests/integration), koji
 * rade nad lokalnim Supabase-om: pokreću se jedan po jedan fajl (ne paralelno),
 * jer dele istu bazu i demo naloge. Unit testovi (tests/unit) dolaze u kasnijim
 * fazama.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Adresa i ključevi lokalnog Supabase-a (iz `supabase status -o env`).
    setupFiles: ["tests/integration/setup-env.ts"],
    // Fajlovi jedan za drugim: zajednička baza i ograničenje broja prijava.
    fileParallelism: false,
    // Pozivi ka bazi preko mreže su sporiji od običnih unit testova.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
