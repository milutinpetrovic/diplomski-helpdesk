/**
 * Integracioni testovi: zahtevi, komentari i istorija.
 *
 * Proverava RPC funkcije create_ticket, update_ticket i add_comment, kao i RLS
 * za tabele tickets, ticket_comments i ticket_history (docs/02, sekcija 8):
 *   - korisnik vidi samo svoje zahteve, nikad interne komentare
 *   - direktan upis u tabele nije dozvoljen nikome
 *   - automatski prelaz waiting_on_customer -> in_progress kad vlasnik odgovori
 */
import { describe, expect, it } from "vitest";
import {
  as,
  CATEGORY_ID,
  createTicket,
  createTicketInStatus,
  expectDbError,
  expectDbOk,
  USERS,
  type TicketRow,
} from "./helpers";

describe("create_ticket", () => {
  // Uspešno kreiranje: status open, nedodeljen, vlasnik je pozivalac, istorija `created`.
  it("korisnik kreira zahtev", async () => {
    const ticket = await createTicket("ana");
    expect(ticket.status).toBe("open");
    expect(ticket.assigned_to).toBeNull();
    expect(ticket.created_by).toBe(USERS.ana.id);
    expect(ticket.number).toBeGreaterThan(1000);

    const ana = await as("ana");
    const history = await expectDbOk(
      ana.from("ticket_history").select("action").eq("ticket_id", ticket.id),
    );
    expect(history).toEqual([{ action: "created" }]);
  });

  // Agent i admin ne kreiraju zahteve (to radi samo korisnik).
  it("agent ne kreira zahtev", async () => {
    const agent = await as("agent");
    await expectDbError(
      agent.rpc("create_ticket", {
        p_title: "Zahtev agenta",
        p_description: "Agent ne bi smeo ovo da kreira.",
        p_category_id: CATEGORY_ID,
      }),
      "FORBIDDEN",
    );
  });

  // Prekratak naslov odbija baza (zaštita i kad se zaobiđe Zod).
  it("prekratak naslov vraća VALIDATION_ERROR", async () => {
    const ana = await as("ana");
    await expectDbError(
      ana.rpc("create_ticket", {
        p_title: "abc",
        p_description: "Opis je dovoljno dugačak.",
        p_category_id: CATEGORY_ID,
      }),
      "VALIDATION_ERROR",
    );
  });

  // Direktan INSERT u tabelu nije dozvoljen (samo kroz RPC).
  it("direktan upis u tickets je zabranjen", async () => {
    const ana = await as("ana");
    const { error } = await ana.from("tickets").insert({
      title: "Direktno",
      description: "Pokušaj direktnog upisa.",
      category_id: CATEGORY_ID,
      created_by: USERS.ana.id,
    });
    expect(error?.code).toBe("42501");
  });
});

describe("vidljivost zahteva", () => {
  // Marko ne vidi Anin zahtev ni kroz tabelu ni kroz RPC (TICKET_NOT_FOUND).
  it("korisnik ne vidi tuđi zahtev", async () => {
    const ticket = await createTicket("ana");
    const marko = await as("marko");
    expect(await expectDbOk(marko.from("tickets").select("id").eq("id", ticket.id))).toEqual([]);
    await expectDbError(
      marko.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Zdravo" }),
      "TICKET_NOT_FOUND",
    );
  });

  // Agent vidi sve zahteve, i nedodeljene.
  it("agent vidi nedodeljen zahtev", async () => {
    const ticket = await createTicket("ana");
    const agent = await as("agent");
    expect(await expectDbOk(agent.from("tickets").select("id").eq("id", ticket.id))).toHaveLength(
      1,
    );
  });
});

describe("update_ticket", () => {
  // Vlasnik menja naslov dok je zahtev otvoren; istorija beleži `updated`.
  it("vlasnik menja naslov otvorenog zahteva", async () => {
    const ticket = await createTicket("ana");
    const ana = await as("ana");
    const updated = await expectDbOk(
      ana
        .rpc("update_ticket", { p_ticket_id: ticket.id, p_title: "Novi naslov zahteva" })
        .single<TicketRow>(),
    );
    expect(updated.title).toBe("Novi naslov zahteva");
  });

  // Vlasnik ne menja prioritet, niti bilo šta kad zahtev više nije otvoren.
  it("vlasnik ne menja prioritet ni zahtev u obradi", async () => {
    const open = await createTicket("ana");
    const ana = await as("ana");
    await expectDbError(
      ana.rpc("update_ticket", { p_ticket_id: open.id, p_priority: "urgent" }),
      "FORBIDDEN",
    );

    const inProgress = await createTicketInStatus("in_progress");
    await expectDbError(
      ana.rpc("update_ticket", { p_ticket_id: inProgress.id, p_title: "Kasna izmena naslova" }),
      "FORBIDDEN",
    );
  });

  // Agent menja prioritet samo na dodeljenom zahtevu.
  it("agent menja prioritet dodeljenog zahteva", async () => {
    const ticket = await createTicketInStatus("in_progress");
    const agent = await as("agent");
    const agent2 = await as("agent2");

    await expectDbError(
      agent2.rpc("update_ticket", { p_ticket_id: ticket.id, p_priority: "high" }),
      "NOT_ASSIGNED_AGENT",
    );
    const updated = await expectDbOk(
      agent
        .rpc("update_ticket", { p_ticket_id: ticket.id, p_priority: "high" })
        .single<TicketRow>(),
    );
    expect(updated.priority).toBe("high");

    const history = await expectDbOk(
      agent
        .from("ticket_history")
        .select("action, old_value, new_value")
        .eq("ticket_id", ticket.id)
        .eq("action", "priority_changed"),
    );
    expect(history).toEqual([
      {
        action: "priority_changed",
        old_value: { priority: "medium" },
        new_value: { priority: "high" },
      },
    ]);
  });

  // Zatvoren zahtev se ne menja.
  it("zatvoren zahtev se ne menja", async () => {
    const ticket = await createTicketInStatus("closed");
    const admin = await as("admin");
    await expectDbError(
      admin.rpc("update_ticket", { p_ticket_id: ticket.id, p_priority: "low" }),
      "TICKET_CLOSED",
    );
  });
});

describe("add_comment", () => {
  // Korisnik ne piše interne beleške.
  it("korisnik ne može da napiše internu belešku", async () => {
    const ticket = await createTicket("ana");
    const ana = await as("ana");
    await expectDbError(
      ana.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Tajna", p_is_internal: true }),
      "FORBIDDEN_INTERNAL_COMMENT",
    );
  });

  // Interne beleške vidi samo tim; vlasnik vidi samo javne komentare.
  it("korisnik ne vidi internu belešku, agent vidi", async () => {
    const ticket = await createTicketInStatus("in_progress");
    const agent = await as("agent");
    await expectDbOk(
      agent.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Interno", p_is_internal: true }),
    );
    await expectDbOk(agent.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Javni odgovor" }));

    const ana = await as("ana");
    const visibleToAna = await expectDbOk(
      ana.from("ticket_comments").select("body, is_internal").eq("ticket_id", ticket.id),
    );
    expect(visibleToAna).toEqual([{ body: "Javni odgovor", is_internal: false }]);

    const visibleToAgent = await expectDbOk(
      agent.from("ticket_comments").select("body").eq("ticket_id", ticket.id),
    );
    expect(visibleToAgent).toHaveLength(2);
  });

  // first_response_at se postavlja samo na prvi JAVNI komentar tima.
  it("prvi javni odgovor tima upisuje first_response_at", async () => {
    const ticket = await createTicketInStatus("in_progress");
    const agent = await as("agent");

    await expectDbOk(
      agent.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Beleška", p_is_internal: true }),
    );
    let row = await expectDbOk(
      agent.from("tickets").select("first_response_at").eq("id", ticket.id).single(),
    );
    expect(row.first_response_at).toBeNull();

    await expectDbOk(agent.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Odgovor" }));
    row = await expectDbOk(
      agent.from("tickets").select("first_response_at").eq("id", ticket.id).single(),
    );
    expect(row.first_response_at).not.toBeNull();
  });

  // Vlasnik odgovori na zahtev koji čeka njega -> automatski in_progress,
  // a u istoriji je akter sistem (actor_id = null).
  it("odgovor vlasnika vraća zahtev u obradu", async () => {
    const ticket = await createTicketInStatus("waiting_on_customer");
    const ana = await as("ana");
    await expectDbOk(
      ana.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Evo traženih podataka." }),
    );

    const row = await expectDbOk(ana.from("tickets").select("status").eq("id", ticket.id).single());
    expect(row.status).toBe("in_progress");

    const history = await expectDbOk(
      ana
        .from("ticket_history")
        .select("actor_id, new_value")
        .eq("ticket_id", ticket.id)
        .eq("action", "status_changed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    );
    expect(history).toEqual({ actor_id: null, new_value: { status: "in_progress" } });
  });

  // Na zatvoren zahtev se ne komentariše.
  it("zatvoren zahtev ne prima komentare", async () => {
    const ticket = await createTicketInStatus("closed");
    const ana = await as("ana");
    await expectDbError(
      ana.rpc("add_comment", { p_ticket_id: ticket.id, p_body: "Još nešto" }),
      "TICKET_CLOSED",
    );
  });

  // Direktan upis komentara nije dozvoljen (samo kroz add_comment).
  it("direktan upis u ticket_comments je zabranjen", async () => {
    const ticket = await createTicket("ana");
    const ana = await as("ana");
    const { error } = await ana
      .from("ticket_comments")
      .insert({ ticket_id: ticket.id, author_id: USERS.ana.id, body: "Direktno" });
    expect(error?.code).toBe("42501");
  });
});
