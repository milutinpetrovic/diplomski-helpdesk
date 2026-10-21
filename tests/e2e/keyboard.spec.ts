/**
 * E2E: rad samo tastaturom (NFZ-4, Faza 10).
 *   - prvi Tab na stranici fokusira link „Preskoči na sadržaj“, a Enter vodi u glavni deo
 *   - meni na telefonu: Enter otvara, Escape zatvara i fokus se vraća na dugme
 *   - dijalog za potvrdu (deaktivacija naloga): Escape zatvara bez izmene
 * Ostatak (forme, kanban tastaturom) pokrivaju auth, ticket-lifecycle i kanban testovi.
 */
import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("preskakanje menija, meni na telefonu i dijalog tastaturom", async ({ page }) => {
  await login(page, "admin");

  // Korak 1: prvi Tab = link za preskakanje menija; Enter prebacuje fokus u <main>.
  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Preskoči na sadržaj" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);

  // Korak 2: telefon — meni se otvara Enter-om, zatvara Escape-om, fokus se vraća.
  await page.setViewportSize({ width: 390, height: 844 });
  const menuButton = page.getByRole("button", { name: "Otvori meni" });
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(menuButton).toBeFocused();

  // Korak 3: dijalog za deaktivaciju naloga — Escape zatvara, nalog ostaje aktivan.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/users?q=marko");
  const deactivate = page.getByRole("button", { name: "Deaktiviraj nalog Marko Marković" });
  await deactivate.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(deactivate).toBeFocused();
});
