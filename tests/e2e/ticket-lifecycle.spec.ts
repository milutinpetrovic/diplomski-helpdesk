/**
 * E2E: ceo život zahteva kroz interfejs (UC-09, UC-11..UC-14, UC-16, UC-17).
 *   1. korisnik prijavljuje zahtev (forma /tickets/new)
 *   2. agent ga preuzima, odgovara i označava kao rešen
 *   3. korisnik vidi odgovor, potvrđuje rešenje i ocenjuje (CSAT, FZ-16)
 *   4. interna beleška agenta se korisniku ne prikazuje (FZ-8)
 * Svaki korisnik radi u svom kontekstu pregledača (odvojene sesije).
 */
import { expect, test } from "@playwright/test";

import { createTicketViaForm, newSession, uniqueTitle } from "./helpers";

test("korisnik prijavi, agent reši, korisnik potvrdi i oceni", async ({ browser }) => {
  // Korak 1: korisnik prijavljuje zahtev.
  const customer = await newSession(browser, "customer");
  const title = uniqueTitle("E2E život zahteva");
  const ticketPath = await createTicketViaForm(customer, title);
  await expect(customer.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(
    customer.locator("main").getByText("Otvoren", { exact: true }).first(),
  ).toBeVisible();

  // Korak 2: agent preuzima zahtev (prelazi u „U obradi“).
  const agent = await newSession(browser, "agent");
  await agent.goto(ticketPath);
  await agent.getByRole("button", { name: "Preuzmi zahtev" }).click();
  await expect(agent.getByText("Zahtev je preuzet.")).toBeVisible();
  await expect(agent.locator("main").getByText("U obradi", { exact: true }).first()).toBeVisible();

  // Korak 3: agent piše javni odgovor i internu belešku.
  await agent.locator("#comment-body").fill("Javni odgovor agenta iz E2E testa.");
  await agent.getByRole("button", { name: "Pošalji", exact: true }).click();
  await expect(agent.getByText("Komentar je dodat.")).toBeVisible();
  await agent.locator("#comment-body").fill("Interna beleška koju korisnik ne sme da vidi.");
  await agent.getByRole("checkbox").check();
  await agent.getByRole("button", { name: "Pošalji", exact: true }).click();
  await expect(agent.getByText("Interna beleška je dodata.")).toBeVisible();

  // Korak 4: agent označava zahtev kao rešen.
  await agent.getByRole("button", { name: "Označi kao rešen" }).click();
  await expect(agent.getByText("Novi status: Rešen.")).toBeVisible();

  // Korak 5: korisnik vidi odgovor i status, ali ne i internu belešku.
  await customer.reload();
  await expect(customer.getByText("Javni odgovor agenta iz E2E testa.")).toBeVisible();
  await expect(customer.getByText("Interna beleška koju korisnik ne sme da vidi.")).toHaveCount(0);
  await expect(customer.locator("main").getByText("Rešen", { exact: true }).first()).toBeVisible();

  // Korak 6: korisnik ocenjuje (5 zvezdica) i potvrđuje rešenje.
  // Klik na petu zvezdicu (oznaka oko skrivenog radio dugmeta), kao što radi korisnik.
  const fiveStars = customer.getByRole("radio", { name: "5 zvezdica" });
  await customer.locator("label").filter({ has: fiveStars }).click();
  await expect(fiveStars).toBeChecked();
  await customer.locator("#rating-comment").fill("Brzo i jasno, hvala!");
  await customer.getByRole("button", { name: "Pošalji ocenu" }).click();
  await expect(customer.getByText("Hvala na oceni!")).toBeVisible();
  await customer.getByRole("button", { name: "Potvrdi rešenje" }).click();
  await expect(customer.getByText("Novi status: Zatvoren.")).toBeVisible();

  // Korak 7: zatvoren zahtev se više ne komentariše.
  await expect(
    customer.getByText("Zahtev je zatvoren, pa se više ne može komentarisati."),
  ).toBeVisible();
});
