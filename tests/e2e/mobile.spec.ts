/**
 * E2E: telefon (širina 390 px, NFZ-1). Meni se otvara dugmetom (bočni panel),
 * a lista, stranica zahteva i kanban tabla nemaju vodoravno pomeranje stranice.
 */
import { expect, test } from "@playwright/test";

import { expectNoHorizontalScroll, login } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("meni, lista i zahtev na telefonu", async ({ page }) => {
  await login(page, "agent");
  await expectNoHorizontalScroll(page);

  // Korak 1: meni je sakriven iza dugmeta; otvara se i vodi na zahteve.
  await page.getByRole("button", { name: "Otvori meni" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Zahtevi" }).click();
  await page.waitForURL("**/tickets");
  await expectNoHorizontalScroll(page);

  // Korak 2: prva kartica iz liste otvara zahtev.
  await page.locator("main ul a[href^='/tickets/']").first().click();
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Korak 3: kanban tabla se pomera unutar sebe, a ne cela stranica.
  await page.goto("/tickets?view=board");
  await expect(page.getByRole("heading", { level: 2, name: /Otvoren/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
