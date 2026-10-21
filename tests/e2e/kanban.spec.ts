/**
 * E2E: kanban tabla (/tickets?view=board) i prevlačenje kartica.
 *   - agent mišem prevuče nedodeljen otvoren zahtev u „U obradi“ = preuzimanje
 *   - zabranjen prelaz (agent: U obradi -> Zatvoren) vraća karticu uz poruku
 *   - tastatura: Space podigne karticu, strelica desno, Space spusti
 * Zahtev pravi korisnik u istom testu, pa test ne zavisi od demo podataka.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

import { createTicketViaForm, newSession, uniqueTitle } from "./helpers";

/** Kolona table po nazivu statusa. */
function column(page: Page, name: string): Locator {
  return page
    .locator("main section")
    .filter({ has: page.getByRole("heading", { level: 2, name }) });
}

/** Prevlačenje mišem: pritisak na karticu, pomeranje u koracima, puštanje iznad kolone. */
async function drag(page: Page, card: Locator, target: Locator): Promise<void> {
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Kartica ili kolona nije vidljiva.");
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + 25, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 });
  await page.mouse.up();
}

test("prevlačenje: preuzimanje, zabranjen prelaz i tastatura", async ({ browser }) => {
  // Priprema: korisnik prijavi nov zahtev.
  const customer = await newSession(browser, "customer");
  const title = uniqueTitle("E2E kanban");
  await createTicketViaForm(customer, title);

  // Korak 1: agent otvara tablu; kartica je u koloni „Otvoren“.
  const agent = await newSession(browser, "agent", { viewport: { width: 1440, height: 900 } });
  await agent.goto("/tickets?view=board");
  const card = agent.locator(`a[aria-label$="${title}"]`);
  await expect(column(agent, "Otvoren").locator(`a[aria-label$="${title}"]`)).toBeVisible();

  // Korak 2: mišem u „U obradi“ = agent preuzima zahtev.
  await drag(agent, card, column(agent, "U obradi"));
  await expect(agent.getByText("Zahtev je preuzet.")).toBeVisible();
  await expect(column(agent, "U obradi").locator(`a[aria-label$="${title}"]`)).toBeVisible();

  // Korak 3: zabranjen prelaz (agent ne zatvara zahtev) — kartica ostaje, poruka objašnjava.
  await drag(agent, card, column(agent, "Zatvoren"));
  await expect(agent.getByText("Prelaz iz „U obradi“ u „Zatvoren“ nije dozvoljen.")).toBeVisible();
  await expect(column(agent, "U obradi").locator(`a[aria-label$="${title}"]`)).toBeVisible();

  // Korak 4: tastatura — Space, strelica desno (Čeka korisnika), Space.
  await card.focus();
  await agent.keyboard.press("Space");
  await agent.keyboard.press("ArrowRight");
  await agent.keyboard.press("Space");
  await expect(agent.getByText("Novi status: Čeka korisnika.")).toBeVisible();
  await expect(column(agent, "Čeka korisnika").locator(`a[aria-label$="${title}"]`)).toBeVisible();
});
