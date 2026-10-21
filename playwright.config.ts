/**
 * Fajl: playwright.config.ts
 * Svrha: podešavanje E2E testova (Playwright) iz tests/e2e/ — pravi pregledač
 * (Chromium) klikće kroz aplikaciju kao korisnik, agent i admin.
 *   - aplikacija se pokreće komandom `pnpm start` (posle `pnpm build`), osim ako
 *     je E2E_BASE_URL već zadat (aplikacija tada već radi na toj adresi)
 *   - testovi idu jedan za drugim (workers: 1), jer dele istu bazu i demo naloge
 *   - kad test padne, čuvaju se snimak ekrana i trag (trace) za pregled
 *     (`pnpm exec playwright show-report`)
 * Pokretanje: `pnpm test:e2e` (traži `pnpm db:start`, `pnpm seed:demo` i `pnpm build`).
 * U CI-u: posao `e2e` u .github/workflows/ci.yml.
 */
import { defineConfig, devices } from "@playwright/test";

/** Adresa aplikacije; ista kao site_url u supabase/config.toml (linkovi iz emailova). */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // Jedan po jedan: zajednička baza, demo nalozi i real-time događaji.
  workers: 1,
  fullyParallel: false,
  // U CI-u test.only u kodu je greška (da se slučajno ne preskoče ostali testovi).
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "sr-RS",
    // Dokazi kad test padne: trag (svaki klik i odgovor servera) i snimak ekrana.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Pokretanje aplikacije za testove (samo kad E2E_BASE_URL nije zadat).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm start",
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
