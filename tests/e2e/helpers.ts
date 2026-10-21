/**
 * Pomoćne funkcije za E2E testove (Playwright, tests/e2e/).
 *
 * Šta je ovde:
 *   - demo nalozi iz supabase/seed.sql (lozinka Lozinka123!)
 *   - prijava kroz pravu formu (/login), kao što to radi korisnik
 *   - novi zahtev kroz formu /tickets/new (svaki test pravi svoj, sa jedinstvenim
 *     naslovom, da ne zavisi od demo podataka i od drugih testova)
 *   - čitanje linka za potvrdu iz Mailpit-a (lokalni „poštanski sandučić“ Supabase-a)
 *   - provera da stranica nema vodoravno pomeranje (telefon, NFZ-1)
 */
import { expect, type Browser, type Page } from "@playwright/test";

/** Lozinka svih demo naloga. */
export const PASSWORD = "Lozinka123!";

/** Demo nalozi po ulozi (supabase/seed.sql). */
export const ACCOUNTS = {
  admin: { email: "admin@helpdesk.test", name: "Admin Adminović" },
  agent: { email: "agent@helpdesk.test", name: "Jelena Agentić" },
  customer: { email: "marko@helpdesk.test", name: "Marko Marković" },
} as const;

export type Role = keyof typeof ACCOUNTS;

/** Mailpit (pokreće ga `supabase start`). */
const MAILPIT = process.env.MAILPIT_URL ?? process.env.INBUCKET_URL ?? "http://127.0.0.1:54324";

/**
 * Prijava kroz formu na /login; čeka kontrolni panel.
 * Ulaz: stranica i uloga (demo nalog).
 */
export async function login(page: Page, role: Role): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(ACCOUNTS[role].email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await page.waitForURL("**/dashboard");
}

/**
 * Nov kontekst pregledača (odvojeni kolačići = odvojen korisnik) sa prijavom.
 * Koristi se kad u istom testu rade dva korisnika (npr. real-time).
 */
export async function newSession(
  browser: Browser,
  role: Role,
  options: { viewport?: { width: number; height: number } } = {},
): Promise<Page> {
  const context = await browser.newContext({ locale: "sr-RS", ...options });
  const page = await context.newPage();
  await login(page, role);
  return page;
}

/** Jedinstven naslov zahteva za jedan test (npr. „E2E život zahteva 1729512345“). */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

/**
 * Korisnik prijavljuje nov zahtev kroz formu /tickets/new.
 * Vraća: adresu stranice novog zahteva (/tickets/<id>).
 */
export async function createTicketViaForm(page: Page, title: string): Promise<string> {
  await page.goto("/tickets/new");
  await page.locator("#title").fill(title);
  await page
    .locator("#description")
    .fill("Opis problema napisan u E2E testu, dovoljno dug za proveru.");
  // Prva prava kategorija (prva opcija je „Izaberite kategoriju“).
  await page.locator("#categoryId").selectOption({ index: 1 });
  await page.locator("#priority").selectOption("high");
  await page.getByRole("button", { name: "Pošalji zahtev" }).click();
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/);
  return new URL(page.url()).pathname;
}

/**
 * Čeka email za datu adresu u Mailpit-u i vraća putanju linka iz njega
 * (npr. /api/auth/callback?token_hash=...&type=email&next=/dashboard).
 */
export async function confirmationPathFromEmail(email: string): Promise<string> {
  const query = encodeURIComponent(`to:"${email}"`);
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = (await (await fetch(`${MAILPIT}/api/v1/search?query=${query}`)).json()) as {
      messages?: { ID: string }[];
    };
    for (const { ID } of search.messages ?? []) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${ID}`)).json()) as {
        HTML: string;
      };
      // U HTML-u je & zapisan kao &amp;; uzima se putanja (adresa aplikacije je baseURL).
      const match = /href="https?:\/\/[^/"]+(\/api\/auth\/callback\?[^"]+)"/.exec(
        message.HTML.replaceAll("&amp;", "&"),
      );
      if (match?.[1]) return match[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Email za ${email} nije stigao u Mailpit.`);
}

/** Proverava da stranica nema vodoravno pomeranje (sadržaj staje u širinu ekrana). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
