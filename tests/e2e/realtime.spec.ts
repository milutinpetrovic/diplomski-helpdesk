/**
 * E2E: obaveštenja i osvežavanje u realnom vremenu (FZ-12, FZ-13), dva
 * prozora pregledača istovremeno:
 *   - korisnik drži otvorenu stranicu svog zahteva
 *   - agent preuzme zahtev i promeni status u svom prozoru
 *   - kod korisnika se BEZ reload-a promene status i brojač na zvoncu
 * Traži Supabase Realtime (`supabase start`); bez njega (REALTIME_TESTS=off,
 * npr. okruženje bez Docker-a) test se preskače, kao i integracioni real-time testovi.
 */
import { expect, test } from "@playwright/test";

import { createTicketViaForm, newSession, uniqueTitle } from "./helpers";

test.skip(process.env.REALTIME_TESTS === "off", "Supabase Realtime nije pokrenut.");

test("korisnik vidi promenu statusa i obaveštenje bez reload-a", async ({ browser }) => {
  // Korak 1: korisnik prijavi zahtev i ostane na njegovoj stranici.
  const customer = await newSession(browser, "customer");
  const ticketPath = await createTicketViaForm(customer, uniqueTitle("E2E real-time"));
  const bell = customer.getByRole("button", { name: /^Obaveštenja/ });
  const bellBefore = (await bell.getAttribute("aria-label")) ?? "";

  // Korak 2: agent u drugom prozoru preuzme zahtev i zatraži odgovor korisnika.
  const agent = await newSession(browser, "agent");
  await agent.goto(ticketPath);
  await agent.getByRole("button", { name: "Preuzmi zahtev" }).click();
  await expect(agent.getByText("Zahtev je preuzet.")).toBeVisible();
  await agent.getByRole("button", { name: "Čeka odgovor korisnika" }).click();
  await expect(agent.getByText("Novi status: Čeka korisnika.")).toBeVisible();

  // Korak 3: kod korisnika, bez reload-a, novi status i nepročitana obaveštenja.
  await expect(
    customer.locator("main").getByText("Čeka korisnika", { exact: true }).first(),
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect(bell).not.toHaveAttribute("aria-label", bellBefore, { timeout: 15_000 });
  await expect(bell).toHaveAttribute("aria-label", /nepročitan/);
});
