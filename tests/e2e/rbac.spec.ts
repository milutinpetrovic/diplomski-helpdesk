/**
 * E2E: kontrola pristupa po ulogama u interfejsu (RBAC, FZ-3, NFZ-2).
 *   - korisnik ne ulazi u /admin i /analytics (stranica „Nemate pristup“)
 *   - agent ne vidi administraciju u meniju i ne ulazi u nju
 *   - admin vidi i otvara analitiku i administraciju
 * Ista pravila proveravaju API (integracioni testovi) i baza (RLS testovi).
 */
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("korisnik nema pristup administraciji i analitici", async ({ page }) => {
  await login(page, "customer");
  for (const path of ["/admin/users", "/admin/categories", "/analytics"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Nemate pristup" })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Analitika" })).toHaveCount(0);
});

test("agent ne vidi administraciju", async ({ page }) => {
  await login(page, "agent");
  await expect(page.getByRole("link", { name: "Korisnici" })).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Nemate pristup" })).toBeVisible();
  // Agent ne prijavljuje zahteve (to rade korisnici).
  await page.goto("/tickets/new");
  await expect(page.getByRole("heading", { name: "Nemate pristup" })).toBeVisible();
});

test("admin otvara analitiku i administraciju", async ({ page }) => {
  await login(page, "admin");
  // Linkovi iz glavnog menija (isti nazivi postoje i na kontrolnom panelu).
  const nav = page.getByRole("navigation", { name: "Glavni meni" });
  await nav.getByRole("link", { name: "Analitika" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Analitika" })).toBeVisible();
  await nav.getByRole("link", { name: "Korisnici" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Korisnici" })).toBeVisible();
});
