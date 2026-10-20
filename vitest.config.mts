/**
 * Konfiguracija Vitest-a (testovi). Dva projekta:
 *   - unit: brzi testovi bez baze (tests/unit), npr. withApi, greške, real-time izbor
 *   - integration: testovi baze nad lokalnim Supabase-om (tests/integration);
 *     fajlovi se pokreću jedan po jedan jer dele istu bazu i demo naloge
 * Komande: `pnpm test:unit`, `pnpm test:db`.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Putanje "@/..." iz tsconfig.json rade i u testovima.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          // Adresa i ključevi lokalnog Supabase-a (iz `supabase status -o env`).
          setupFiles: ["tests/integration/setup-env.ts"],
          // Fajlovi jedan za drugim: zajednička baza i ograničenje broja prijava.
          fileParallelism: false,
          // Pozivi ka bazi preko mreže su sporiji od običnih unit testova.
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
