/**
 * E2E: promena jezika (NFZ-7). Dugme EN u zaglavlju prebacuje interfejs na
 * engleski; izbor se pamti u kolačiću NEXT_LOCALE i ostaje posle reload-a.
 */
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("srpski -> engleski, izbor se pamti", async ({ page }) => {
  await login(page, "customer");
  await expect(page.getByRole("link", { name: "Moji zahtevi" }).first()).toBeVisible();

  // Korak 1: dugme „Engleski“ (EN) u zaglavlju.
  await page.getByRole("button", { name: "Engleski" }).click();
  await expect(page.getByRole("link", { name: "My tickets" }).first()).toBeVisible();

  // Korak 2: posle reload-a i na drugoj stranici jezik ostaje engleski.
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { level: 1, name: "My tickets" })).toBeVisible();

  // Korak 3: vraćanje na srpski (da ne utiče na druge testove istog naloga).
  await page.getByRole("button", { name: "Serbian" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Moji zahtevi" })).toBeVisible();
});
