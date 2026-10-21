/**
 * E2E: sve stranice na tri širine ekrana (NFZ-1, Faza 10): telefon 390 px,
 * tablet 768 px i računar 1280 px. Za svaku ulogu se otvara svaka njena
 * stranica i proverava da stranica nema vodoravno pomeranje (tabele i kanban
 * tabla smeju da se pomeraju unutar sebe, ali ne cela stranica).
 * Primer greške koju ovaj test hvata: lista naloga (/admin/users) na tabletu
 * je bila šira od ekrana jer su kolone počinjale već od širine md.
 */
import { expect, test } from "@playwright/test";

import { expectNoHorizontalScroll, login, type Role } from "./helpers";

/** Širine ekrana: telefon, tablet, računar. */
const WIDTHS = [390, 768, 1280];

/** Stranice po ulozi ("detail" = prvi zahtev iz liste). */
const PAGES: Record<Role, string[]> = {
  customer: [
    "/dashboard",
    "/tickets",
    "/tickets?view=board",
    "/tickets/new",
    "detail",
    "/notifications",
    "/profile",
  ],
  agent: ["/dashboard", "/tickets", "/tickets?view=board", "detail", "/notifications"],
  admin: ["/dashboard", "/analytics", "/admin/users", "/admin/categories", "detail"],
};

for (const role of Object.keys(PAGES) as Role[]) {
  test(`stranice bez vodoravnog pomeranja: ${role}`, async ({ page }) => {
    // Priprema: prijava i adresa prvog zahteva iz liste.
    await login(page, role);
    await page.goto("/tickets");
    const detail = await page
      .locator("main a[href^='/tickets/']:not([href$='/new'])")
      .first()
      .getAttribute("href");
    expect(detail).not.toBeNull();

    // Provera: svaka stranica na svakoj širini.
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PAGES[role]) {
        await page.goto(path === "detail" ? detail! : path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await test.step(`${path} @ ${width}px`, () => expectNoHorizontalScroll(page));
      }
    }
  });
}
