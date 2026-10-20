/**
 * Integracioni testovi: upravljanje korisnicima (RPC admin_update_user).
 *
 * Koristi novi, privremeni nalog (pravi ga service_role klijent), da demo
 * nalozi iz seed-a ostanu nepromenjeni za ostale testove.
 *   - samo admin menja uloge; ne sme sebe
 *   - deaktiviran nalog ne vidi ništa i ne može da radi ništa
 *   - kad agent izgubi ulogu, njegovi nerešeni zahtevi se vraćaju u red (open)
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  as,
  createTicket,
  expectDbError,
  expectDbOk,
  serviceClient,
  signInAs,
  USERS,
  type TicketRow,
} from "./helpers";

/** ID-jevi privremenih naloga koje brišemo posle testova. */
const createdUserIds: string[] = [];

/** Pravi privremen nalog (uloga customer) i vraća njegov ID i email. */
async function createTempUser(): Promise<{ id: string; email: string }> {
  const email = `temp-${randomUUID()}@helpdesk.test`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: "Privremena123!",
    email_confirm: true,
    user_metadata: { full_name: "Privremeni Nalog" },
  });
  if (error || !data.user) throw new Error(`Nalog nije napravljen: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

afterAll(async () => {
  // Brisanje privremenih naloga (profil se briše kaskadno). Zahtevi koje su
  // eventualno imali kao dodeljeni agent ostaju, sa assigned_to = null.
  for (const id of createdUserIds) await serviceClient().auth.admin.deleteUser(id);
});

describe("admin_update_user", () => {
  // Korisnik i agent ne menjaju uloge.
  it("samo admin menja uloge", async () => {
    for (const user of ["ana", "agent"] as const) {
      const client = await as(user);
      await expectDbError(
        client.rpc("admin_update_user", { p_user_id: USERS.marko.id, p_role: "agent" }),
        "FORBIDDEN",
      );
    }
  });

  // Admin ne menja sebe (da ne bi slučajno ostao bez admin prava).
  it("admin ne menja sopstveni nalog", async () => {
    const admin = await as("admin");
    await expectDbError(
      admin.rpc("admin_update_user", { p_user_id: USERS.admin.id, p_role: "agent" }),
      "CANNOT_MODIFY_SELF",
    );
  });

  // Nepostojeći korisnik.
  it("nepostojeći korisnik vraća NOT_FOUND", async () => {
    const admin = await as("admin");
    await expectDbError(
      admin.rpc("admin_update_user", { p_user_id: randomUUID(), p_role: "agent" }),
      "NOT_FOUND",
    );
  });

  // Ceo tok: unapređenje u agenta, preuzimanje zahteva, deaktivacija.
  it("deaktivacija agenta vraća njegove zahteve u red i zaključava nalog", async () => {
    const admin = await as("admin");
    const temp = await createTempUser();

    // Korak 1: admin unapređuje nalog u agenta.
    const profile = await expectDbOk(
      admin
        .rpc("admin_update_user", { p_user_id: temp.id, p_role: "agent" })
        .single<{ role: string }>(),
    );
    expect(profile.role).toBe("agent");

    // Korak 2: novi agent preuzima zahtev.
    const tempClient = await signInAs(temp.email, "Privremena123!");
    const ticket = await createTicket("ana");
    await expectDbOk(
      tempClient.rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: temp.id }),
    );

    // Korak 3: deaktivacija -> zahtev nedodeljen i ponovo open.
    await expectDbOk(admin.rpc("admin_update_user", { p_user_id: temp.id, p_is_active: false }));
    const after = await expectDbOk(
      admin.from("tickets").select("*").eq("id", ticket.id).single<TicketRow>(),
    );
    expect(after.assigned_to).toBeNull();
    expect(after.status).toBe("open");

    // Korak 4: deaktiviran nalog ništa ne vidi i ne može da radi.
    expect(await expectDbOk(tempClient.from("tickets").select("id"))).toEqual([]);
    await expectDbError(
      tempClient.rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: temp.id }),
      "ACCOUNT_DISABLED",
    );
  });
});
