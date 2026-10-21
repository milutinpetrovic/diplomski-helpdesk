/**
 * RLS matrica, napomena ispod tabele (docs/02-baza-podataka.md, sekcija 8):
 * neaktivan nalog (is_active = false) ne vidi ništa ni u jednoj tabeli, a
 * RPC funkcije mu vraćaju ACCOUNT_DISABLED. Sve politike zato traže da
 * current_user_role() nije null (vraća null za neaktivne).
 *
 * Privremeni nalog napravi zahtev i dobije obaveštenje, pa ga admin
 * deaktivira i on posle toga više ne vidi ni svoje podatke.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  as,
  CATEGORY_ID,
  expectDbError,
  expectDbOk,
  serviceClient,
  USERS,
  type TicketRow,
} from "../helpers";
import { createTempUser, deleteTempUsers, expectNoRows, type TempUser } from "./rls-helpers";

/** Privremeni nalozi napravljeni u ovom fajlu. */
const created: string[] = [];
let temp: TempUser;
let ticket: TicketRow;

beforeAll(async () => {
  // Korak 1: nov korisnik prijavi zahtev, agent ga preuzme (korisnik dobija obaveštenje).
  temp = await createTempUser(created);
  ticket = await expectDbOk(
    temp.client
      .rpc("create_ticket", {
        p_title: "Zahtev neaktivnog naloga",
        p_description: "Nalog će biti deaktiviran posle ovog zahteva.",
        p_category_id: CATEGORY_ID,
      })
      .single<TicketRow>(),
  );
  const agent = await as("agent");
  await expectDbOk(
    agent.rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: USERS.agent.id }),
  );

  // Korak 2: pre deaktivacije nalog vidi svoje podatke.
  const before = await expectDbOk(temp.client.from("tickets").select("id"));
  expect(before).toEqual([{ id: ticket.id }]);

  // Korak 3: admin deaktivira nalog.
  const admin = await as("admin");
  await expectDbOk(admin.rpc("admin_update_user", { p_user_id: temp.id, p_is_active: false }));
});

afterAll(async () => {
  // Zahtev ima stranu vezu na profil, pa se briše pre naloga (samo čišćenje).
  await serviceClient().from("tickets").delete().eq("id", ticket.id);
  await deleteTempUsers(created);
});

describe("neaktivan nalog", () => {
  it("SELECT · ne vidi nijedan red ni u jednoj tabeli (ni svoje)", async () => {
    const { client } = temp;
    await expectNoRows(client.from("profiles").select("id"));
    await expectNoRows(client.from("tickets").select("id"));
    await expectNoRows(client.from("ticket_comments").select("id"));
    await expectNoRows(client.from("ticket_history").select("id"));
    await expectNoRows(client.from("ticket_ratings").select("id"));
    await expectNoRows(client.from("notifications").select("id"));
    await expectNoRows(client.from("categories").select("id"));
  });

  it("UPDATE i DELETE · ne menja ni svoj profil ni obaveštenja", async () => {
    const { client } = temp;
    await expectNoRows(
      client.from("profiles").update({ full_name: "Vratio sam se" }).eq("id", temp.id).select("id"),
    );
    await expectNoRows(
      client
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", temp.id)
        .select("id"),
    );
    await expectNoRows(
      client.from("notifications").delete().eq("recipient_id", temp.id).select("id"),
    );
  });

  it("RPC · svaka akcija vraća ACCOUNT_DISABLED", async () => {
    const { client } = temp;
    await expectDbError(
      client.rpc("create_ticket", {
        p_title: "Još jedan zahtev",
        p_description: "Neaktivan nalog ne sme ovo da uradi.",
        p_category_id: CATEGORY_ID,
      }),
      "ACCOUNT_DISABLED",
    );
    await expectDbError(
      client.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Halo?" }),
      "ACCOUNT_DISABLED",
    );
  });
});
