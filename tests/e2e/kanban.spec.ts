/**
 * E2E: kanban tabla (/tickets?view=board) i prevlačenje kartica.
 *   - agent mišem prevuče nedodeljen otvoren zahtev u „U obradi“ = preuzimanje
 *   - zabranjen prelaz (agent: U obradi -> Zatvoren) vraća karticu uz poruku
 *   - tastatura: Space podigne karticu, strelica desno, Space spusti
 * Svaki korak prevlačenja čeka najavu za čitač ekrana, da test ne bude brži
 * od biblioteke (na sporijoj mašini u CI-u je test zbog toga povremeno padao).
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

/** Najava za čitač ekrana koju biblioteka upisuje u oblast „status“. */
function announcement(page: Page): Locator {
  return page.locator('[id^="DndLiveRegion"]');
}

/**
 * Prevlačenje mišem: pritisak na karticu, pomeranje u koracima, puštanje iznad
 * kolone. Dve najave se čekaju: „iznad kolone <izvor>“ (prevlačenje je stvarno
 * počelo) i „iznad kolone <cilj>“ pre puštanja; na sporijoj mašini (CI)
 * biblioteka inače ne stigne da prepozna kolonu pre puštanja.
 */
async function drag(
  page: Page,
  card: Locator,
  sourceName: string,
  target: Locator,
  targetName: string,
): Promise<void> {
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Kartica ili kolona nije vidljiva.");
  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + 25, { steps: 3 });
  await expect(announcement(page)).toHaveText(new RegExp(`je iznad kolone ${sourceName}\\.$`));
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 });
  await expect(announcement(page)).toHaveText(new RegExp(`je iznad kolone ${targetName}\\.$`));
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
  await drag(agent, card, "Otvoren", column(agent, "U obradi"), "U obradi");
  await expect(agent.getByText("Zahtev je preuzet.")).toBeVisible();
  // Kartica je odmah premeštena (pre odgovora servera); ime agenta na njoj znači
  // da je stigla i osvežena tabla sa servera, pa se kartica više neće pomeriti
  // ispod miša dok traje sledeće prevlačenje.
  await expect(column(agent, "U obradi").locator(`a[aria-label$="${title}"]`)).toContainText(
    "Jelena Agentić",
  );

  // Korak 3: zabranjen prelaz (agent ne zatvara zahtev) — kartica ostaje, poruka objašnjava.
  await drag(agent, card, "U obradi", column(agent, "Zatvoren"), "Zatvoren");
  await expect(agent.getByText("Prelaz iz „U obradi“ u „Zatvoren“ nije dozvoljen.")).toBeVisible();
  await expect(column(agent, "U obradi").locator(`a[aria-label$="${title}"]`)).toBeVisible();

  // Korak 4: tastatura — Space, strelica desno (Čeka korisnika), Space.
  // Posle svakog tastera čeka se najava za čitač ekrana (oblast „status“ koju
  // pravi biblioteka): strelice se slušaju tek kad je kartica podignuta, pa bi
  // prebrz pritisak propao i kartica bi bila spuštena u istu kolonu.
  await card.focus();
  await agent.keyboard.press("Space");
  await expect(announcement(agent)).toHaveText(/je iznad kolone U obradi\.$/);
  await agent.keyboard.press("ArrowRight");
  await expect(announcement(agent)).toHaveText(/je iznad kolone Čeka korisnika\.$/);
  await agent.keyboard.press("Space");
  await expect(agent.getByText("Novi status: Čeka korisnika.")).toBeVisible();
  await expect(column(agent, "Čeka korisnika").locator(`a[aria-label$="${title}"]`)).toBeVisible();
});
