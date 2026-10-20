/**
 * Integracioni testovi: dodela zahteva, ocene (CSAT) i obaveštenja.
 *
 * Proverava RPC funkcije assign_ticket i rate_ticket i RLS za
 * ticket_ratings i notifications (docs/02, sekcija 8).
 */
import { describe, expect, it } from "vitest";
import {
  as,
  createTicket,
  createTicketInStatus,
  expectDbError,
  expectDbOk,
  USERS,
  type TicketRow,
} from "./helpers";

describe("assign_ticket", () => {
  // Agent preuzima nedodeljen zahtev: dodela + status in_progress + istorija.
  it("agent preuzima zahtev", async () => {
    const ticket = await createTicket("ana");
    const agent = await as("agent");
    const updated = await expectDbOk(
      agent
        .rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: USERS.agent.id })
        .single<TicketRow>(),
    );
    expect(updated.assigned_to).toBe(USERS.agent.id);
    expect(updated.status).toBe("in_progress");

    const actions = await expectDbOk(
      agent.from("ticket_history").select("action").eq("ticket_id", ticket.id).order("created_at"),
    );
    expect(actions.map((row) => row.action)).toEqual(["created", "assigned", "status_changed"]);
  });

  // Drugi agent ne može da preuzme već preuzet zahtev.
  it("već preuzet zahtev vraća TICKET_ALREADY_ASSIGNED", async () => {
    const ticket = await createTicketInStatus("in_progress");
    const agent2 = await as("agent2");
    await expectDbError(
      agent2.rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: USERS.agent2.id }),
      "TICKET_ALREADY_ASSIGNED",
    );
  });

  // Agent ne dodeljuje zahtev drugome; korisnik ne dodeljuje uopšte.
  it("agent ne dodeljuje drugome, korisnik ne dodeljuje", async () => {
    const ticket = await createTicket("ana");
    const agent = await as("agent");
    await expectDbError(
      agent.rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: USERS.agent2.id }),
      "FORBIDDEN",
    );
    const ana = await as("ana");
    await expectDbError(
      ana.rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: USERS.agent.id }),
      "FORBIDDEN",
    );
  });

  // Admin dodeljuje samo članu tima; oslobađanje vraća zahtev u open.
  it("admin dodeljuje agentu i oslobađa zahtev", async () => {
    const ticket = await createTicket("ana");
    const admin = await as("admin");
    await expectDbError(
      admin.rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: USERS.marko.id }),
      "ASSIGNEE_NOT_AGENT",
    );

    await expectDbOk(
      admin.rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: USERS.agent2.id }),
    );
    const released = await expectDbOk(
      admin.rpc("assign_ticket", { p_ticket_id: ticket.id }).single<TicketRow>(),
    );
    expect(released.assigned_to).toBeNull();
    expect(released.status).toBe("open");
  });

  // Dodeljeni agent dobija obaveštenje ticket_assigned.
  it("dodela šalje obaveštenje agentu", async () => {
    const ticket = await createTicket("ana");
    const admin = await as("admin");
    await expectDbOk(
      admin.rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: USERS.agent2.id }),
    );

    const agent2 = await as("agent2");
    const notifications = await expectDbOk(
      agent2
        .from("notifications")
        .select("type")
        .eq("ticket_id", ticket.id)
        .eq("type", "ticket_assigned"),
    );
    expect(notifications).toHaveLength(1);
  });
});

describe("rate_ticket", () => {
  // Ocena pre rešavanja nije dozvoljena.
  it("nerešen zahtev se ne ocenjuje", async () => {
    const ticket = await createTicketInStatus("in_progress");
    const ana = await as("ana");
    await expectDbError(
      ana.rpc("rate_ticket", { p_ticket_id: ticket.id, p_score: 5 }),
      "TICKET_NOT_RESOLVED",
    );
  });

  // Vlasnik ocenjuje jednom; agent dobija obaveštenje; druga ocena se odbija.
  it("vlasnik ocenjuje rešen zahtev jednom", async () => {
    const ticket = await createTicketInStatus("resolved");
    const ana = await as("ana");
    const rating = await expectDbOk(
      ana
        .rpc("rate_ticket", { p_ticket_id: ticket.id, p_score: 4, p_comment: "Dobro" })
        .single<{ score: number }>(),
    );
    expect(rating.score).toBe(4);
    await expectDbError(
      ana.rpc("rate_ticket", { p_ticket_id: ticket.id, p_score: 5 }),
      "ALREADY_RATED",
    );

    const agent = await as("agent");
    const notifications = await expectDbOk(
      agent
        .from("notifications")
        .select("type")
        .eq("ticket_id", ticket.id)
        .eq("type", "ticket_rated"),
    );
    expect(notifications).toHaveLength(1);
  });

  // Ocena van opsega 1–5 se odbija.
  it("ocena 6 vraća VALIDATION_ERROR", async () => {
    const ticket = await createTicketInStatus("resolved");
    const ana = await as("ana");
    await expectDbError(
      ana.rpc("rate_ticket", { p_ticket_id: ticket.id, p_score: 6 }),
      "VALIDATION_ERROR",
    );
  });

  // Agent ne ocenjuje (samo vlasnik).
  it("agent ne ocenjuje", async () => {
    const ticket = await createTicketInStatus("resolved");
    const agent = await as("agent");
    await expectDbError(
      agent.rpc("rate_ticket", { p_ticket_id: ticket.id, p_score: 5 }),
      "FORBIDDEN",
    );
  });
});

describe("notifications", () => {
  // Kreiranje zahteva obaveštava ceo tim, a ne autora i ne druge korisnike.
  it("ticket_created stiže timu, ne korisnicima", async () => {
    const ticket = await createTicket("ana");
    for (const user of ["agent", "agent2", "admin"] as const) {
      const client = await as(user);
      const rows = await expectDbOk(
        client
          .from("notifications")
          .select("id")
          .eq("ticket_id", ticket.id)
          .eq("type", "ticket_created"),
      );
      expect(rows, user).toHaveLength(1);
    }
    for (const user of ["ana", "marko"] as const) {
      const client = await as(user);
      const rows = await expectDbOk(
        client.from("notifications").select("id").eq("ticket_id", ticket.id),
      );
      expect(rows, user).toHaveLength(0);
    }
  });

  // Primalac menja samo is_read; druge kolone ne može.
  it("primalac označava obaveštenje kao pročitano", async () => {
    const ticket = await createTicket("ana");
    const agent = await as("agent");
    const [notification] = await expectDbOk(
      agent.from("notifications").select("id").eq("ticket_id", ticket.id),
    );
    expect(notification).toBeDefined();

    await expectDbOk(
      agent.from("notifications").update({ is_read: true }).eq("id", notification!.id),
    );
    const { error } = await agent
      .from("notifications")
      .update({ type: "ticket_rated" })
      .eq("id", notification!.id);
    expect(error?.code).toBe("42501");
  });

  // Korisnik ne vidi i ne briše tuđa obaveštenja.
  it("tuđa obaveštenja nisu vidljiva", async () => {
    const ticket = await createTicket("ana");
    const marko = await as("marko");
    const { data } = await marko
      .from("notifications")
      .delete()
      .eq("ticket_id", ticket.id)
      .select("id");
    expect(data).toEqual([]);
  });
});
