/**
 * E2E: prijava, registracija i odjava (UC-01..UC-04, FZ-1).
 *   - nov korisnik se registruje, potvrdi email linkom iz Mailpit-a i stiže na panel
 *   - pogrešna lozinka daje prevedenu poruku, a ne grešku stranice
 *   - odjava vraća na /login, a zaštićena stranica traži ponovnu prijavu
 * Registracija traži pravi Supabase Auth i Mailpit (`supabase start`).
 */
import { expect, test } from "@playwright/test";

import { ACCOUNTS, confirmationPathFromEmail, login } from "./helpers";

test("registracija, potvrda emaila i prvi ulazak", async ({ page }) => {
  // Korak 1: forma za registraciju.
  const email = `e2e-${Date.now()}@helpdesk.test`;
  await page.goto("/register");
  await page.locator("#fullName").fill("E2E Korisnik");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("E2eLozinka123!");
  await page.locator("#confirmPassword").fill("E2eLozinka123!");
  await page.getByRole("button", { name: "Napravi nalog" }).click();
  await expect(page.getByText("Proverite email")).toBeVisible();

  // Korak 2: link iz emaila potvrđuje nalog i prijavljuje korisnika.
  await page.goto(await confirmationPathFromEmail(email));
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E Korisnik");

  // Korak 3: nov nalog je uvek korisnik (vidi „Moji zahtevi“, ne vidi administraciju).
  await expect(page.getByRole("link", { name: "Moji zahtevi" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Korisnici" })).toHaveCount(0);
});

test("pogrešna lozinka daje razumljivu poruku", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#email").fill(ACCOUNTS.customer.email);
  await page.locator("#password").fill("PogresnaLozinka1!");
  await page.getByRole("button", { name: "Prijavi se" }).click();
  // Ostaje na prijavi, uz prevedenu poruku (errors.INVALID_CREDENTIALS).
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("alert").or(page.locator("[data-sonner-toast]")).first(),
  ).toBeVisible();
});

test("odjava i zaštita stranica", async ({ page }) => {
  await login(page, "customer");
  await page.getByRole("button", { name: "Odjava" }).click();
  await page.waitForURL(/\/login/);
  // Zaštićena stranica bez prijave vodi na prijavu (proxy.ts) sa povratnom adresom.
  await page.goto("/tickets");
  await expect(page).toHaveURL(/\/login\?next=%2Ftickets/);
});
