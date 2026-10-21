/**
 * RLS matrica, red `notifications` (docs/02-baza-podataka.md, sekcija 8).
 *
 *   SELECT: samo primalac (recipient_id = auth.uid()), za svaku ulogu
 *   INSERT: samo RPC (obaveštenja prave RPC funkcije posle izmene zahteva)
 *   UPDATE: primalac, samo kolona is_read
 *   DELETE: primalac
 * Obaveštenja se prave stvarnim tokom: admin dodeli Anin zahtev agentu, pa
 * Ana dobija obaveštenje o promeni, a agent o dodeli.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  createTicketInStatus,
  expectNoDbError,
  USERS,
  type TicketRow,
} from "../helpers";
import { asRole, expectNoRows, expectPermissionDenied, visibleRows } from "./rls-helpers";

/** Zahtev iz čijeg toka nastaju obaveštenja. */
let ticket: TicketRow;
/** Po jedno obaveštenje Ane i agenta za taj zahtev. */
let anaNotificationId = "";
let agentNotificationId = "";

beforeAll(async () => {
  ticket = await createTicketInStatus("resolved");
  const ana = await asRole("customer");
  const agent = await asRole("agent");
  const [anaRow] = await visibleRows(
    ana.from("notifications").select("id").eq("ticket_id", ticket.id),
  );
  const [agentRow] = await visibleRows(
    agent.from("notifications").select("id").eq("ticket_id", ticket.id),
  );
  if (!anaRow || !agentRow) throw new Error("Tok zahteva nije napravio obaveštenja.");
  anaNotificationId = anaRow.id;
  agentNotificationId = agentRow.id;
});

describe("notifications · SELECT", () => {
  it("SELECT · gost: nema pristup", async () => {
    await expectPermissionDenied(anonClient().from("notifications").select("id"));
  });

  it("SELECT · svaka uloga: vidi samo obaveštenja kojima je primalac", async () => {
    for (const [role, id] of [
      ["customer", USERS.ana.id],
      ["agent", USERS.agent.id],
      ["admin", USERS.admin.id],
    ] as const) {
      const client = await asRole(role);
      const rows = await visibleRows(client.from("notifications").select("recipient_id"));
      expect(rows.every((row) => row.recipient_id === id)).toBe(true);
    }
  });

  it("SELECT · tuđe obaveštenje se ne vidi ni po ID-ju (ni admin)", async () => {
    const ana = await asRole("customer");
    await expectNoRows(ana.from("notifications").select("id").eq("id", agentNotificationId));
    const admin = await asRole("admin");
    await expectNoRows(admin.from("notifications").select("id").eq("id", anaNotificationId));
  });
});

describe("notifications · INSERT", () => {
  it("INSERT · svi: direktan upis nije dozvoljen", async () => {
    for (const role of ["customer", "agent", "admin"] as const) {
      const client = await asRole(role);
      await expectPermissionDenied(
        client.from("notifications").insert({
          recipient_id: USERS.ana.id,
          ticket_id: ticket.id,
          type: "status_changed",
        }),
      );
    }
  });
});

describe("notifications · UPDATE", () => {
  it("UPDATE · primalac: označava svoje obaveštenje kao pročitano", async () => {
    const ana = await asRole("customer");
    await expectNoDbError(
      ana.from("notifications").update({ is_read: true }).eq("id", anaNotificationId),
    );
    const [row] = await visibleRows(
      ana.from("notifications").select("is_read").eq("id", anaNotificationId),
    );
    expect(row).toEqual({ is_read: true });
  });

  it("UPDATE · tuđe obaveštenje se ne menja", async () => {
    const ana = await asRole("customer");
    await expectNoRows(
      ana
        .from("notifications")
        .update({ is_read: true })
        .eq("id", agentNotificationId)
        .select("id"),
    );
  });

  it("UPDATE · primalac: ostale kolone se ne menjaju", async () => {
    const ana = await asRole("customer");
    await expectPermissionDenied(
      ana
        .from("notifications")
        .update({ recipient_id: USERS.marko.id })
        .eq("id", anaNotificationId),
    );
    await expectPermissionDenied(
      ana.from("notifications").update({ type: "comment_added" }).eq("id", anaNotificationId),
    );
  });
});

describe("notifications · DELETE", () => {
  it("DELETE · tuđe obaveštenje se ne briše", async () => {
    const ana = await asRole("customer");
    await expectNoRows(
      ana.from("notifications").delete().eq("id", agentNotificationId).select("id"),
    );
  });

  it("DELETE · primalac: briše svoje obaveštenje", async () => {
    const ana = await asRole("customer");
    const rows = await visibleRows(
      ana.from("notifications").delete().eq("id", anaNotificationId).select("id"),
    );
    expect(rows).toEqual([{ id: anaNotificationId }]);
  });
});
