/**
 * Konfiguracija Vitest-a (testovi). Dva projekta:
 *   - unit: brzi testovi bez baze (tests/unit), npr. withApi, greške, real-time izbor
 *   - integration: testovi baze nad lokalnim Supabase-om (tests/integration);
 *     fajlovi se pokreću jedan po jedan jer dele istu bazu i demo naloge
 * Komande: `pnpm test:unit`, `pnpm test:db`, a `pnpm test:coverage` pokreće oba
 * projekta i meri pokrivenost koda (izveštaj u coverage/, za poglavlje o testiranju).
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Putanje "@/..." iz tsconfig.json rade i u testovima.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // Pokrivenost (samo uz --coverage): koliki deo poslovne logike testovi izvršavaju.
    // Mere se servisi, pravila (policies), API rute i pomoćne biblioteke; stranice i
    // React komponente pokrivaju E2E testovi (Playwright), ne ovaj izveštaj.
    coverage: {
      provider: "v8",
      include: ["src/services/**/*.ts", "src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: ["src/lib/openapi/routes/**", "**/*.d.ts"],
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: "coverage",
      // Izveštaj se pravi i kad neki test padne (da se vidi stanje pokrivenosti).
      reportOnFailure: true,
    },
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
