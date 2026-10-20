/**
 * Integracioni testovi: API rute za zahteve, komentare, ocene, kategorije i
 * agente (Faza 5a), nad pravim lokalnim Supabase-om.
 *
 * Rute se pozivaju kao što ih poziva Swagger ili Postman: sa
 * `Authorization: Bearer <JWT>` demo naloga. Tako se proverava ceo lanac:
 * ruta -> withApi -> servis -> politike -> RPC funkcija / RLS u bazi.
 *
 * Glavni scenario (kriterijumi Faze 5 iz docs/07):
 *   korisnik kreira zahtev -> agent ga preuzima, piše internu belešku i
 *   javni odgovor -> traži informacije -> korisnik odgovara (automatski
 *   povratak u obradu) -> agent rešava -> korisnik ocenjuje i potvrđuje.
 * Usput: interna beleška se ne vidi kao korisnik (ni u listi ni u detaljima),
 * first_response_at / resolved_at / closed_at se ispravno popunjavaju, a
 * dozvole (permissions) prate ulogu i status.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { GET as getAgents } from "@/app/api/agents/route";
import { GET as getCategories } from "@/app/api/categories/route";
import { POST as assignTicket } from "@/app/api/tickets/[id]/assign/route";
import { GET as listComments, POST as addComment } from "@/app/api/tickets/[id]/comments/route";
import { GET as getHistory } from "@/app/api/tickets/[id]/history/route";
import { POST as rateTicket } from "@/app/api/tickets/[id]/rating/route";
import { GET as getTicket, PATCH as patchTicket } from "@/app/api/tickets/[id]/route";
import { POST as changeStatus } from "@/app/api/tickets/[id]/status/route";
import { GET as listTickets, POST as createTicket } from "@/app/api/tickets/route";
import type { RouteHandler } from "@/lib/api/with-api";
import { as, CATEGORY_ID, USERS, type SeedUser } from "./helpers";

/** Pristupni tokeni demo naloga (kao „Authorize“ u Swagger-u). */
const tokens: Partial<Record<SeedUser, string>> = {};

beforeAll(async () => {
  for (const user of ["ana", "marko", "agent", "agent2", "admin"] as const) {
    const { data } = await (await as(user)).auth.getSession();
    if (!data.session) throw new Error(`Nema sesije za ${user}`);
    tokens[user] = data.session.access_token;
  }
});

/** Opcije poziva rute. */
interface CallOptions {
  /** ID zahteva za rute sa {id} u putanji. */
  id?: string;
  /** JSON telo (za POST/PATCH). */
  body?: unknown;
  /** Query parametri (?status=open...). */
  query?: Record<string, string>;
}

/**
 * Poziva rutu u ime demo naloga i vraća HTTP status i JSON telo odgovora.
 */
async function call(
  route: RouteHandler,
  user: SeedUser,
  method: string,
  { id, body, query }: CallOptions = {},
) {
  const url = new URL("http://localhost/api/test");
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const response = await route(
    new Request(url, {
      method,
      headers: { Authorization: `Bearer ${tokens[user]}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve(id ? { id } : {}) },
  );
  const text = await response.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- telo odgovora se proverava u testu
  const json: any = text ? JSON.parse(text) : undefined;
  return { status: response.status, json };
}

/** Jedinstvena reč za pretragu, da test nađe baš svoj zahtev. */
const MARKER = `testmarker${Date.now()}`;

describe("tok zahteva kroz API (korisnik -> agent -> korisnik)", () => {
  let ticketId = "";

  it("korisnik kreira zahtev (201, open, dozvole korisnika)", async () => {
    const { status, json } = await call(createTicket, "ana", "POST", {
      body: {
        title: `Ne radi VPN ${MARKER}`,
        description: "Od jutros ne mogu da se povežem na VPN iz kućne mreže.",
        categoryId: CATEGORY_ID,
        priority: "high",
      },
    });
    expect(status).toBe(201);
    expect(json).toMatchObject({
      status: "open",
      priority: "high",
      createdBy: USERS.ana.id,
      assignedTo: null,
      assignee: null,
      creator: { id: USERS.ana.id, role: "customer" },
      category: { id: CATEGORY_ID, slug: "technical" },
      rating: null,
      permissions: {
        allowedTransitions: ["closed"],
        canComment: true,
        canCommentInternal: false,
        canAssign: false,
        canRate: false,
        canEdit: true,
      },
    });
    expect(json.number).toBeGreaterThan(1000);
    ticketId = json.id;
  });

  it("tuđi korisnik dobija 404, a agent ne može da kreira zahtev", async () => {
    const other = await call(getTicket, "marko", "GET", { id: ticketId });
    expect(other.status).toBe(404);
    expect(other.json.error.code).toBe("TICKET_NOT_FOUND");

    const agentCreate = await call(createTicket, "agent", "POST", {
      body: {
        title: "Agent pravi zahtev",
        description: "Ovo ne bi smelo da uspe.",
        categoryId: CATEGORY_ID,
      },
    });
    expect(agentCreate.status).toBe(403);
  });

  it("agent nalazi zahtev među nedodeljenima pretragom", async () => {
    const { status, json } = await call(listTickets, "agent", "GET", {
      query: { assigneeId: "unassigned", q: MARKER.slice(0, 12), status: "open", priority: "" },
    });
    expect(status).toBe(200);
    expect(json.items.map((item: { id: string }) => item.id)).toContain(ticketId);
    expect(json.items[0]).toMatchObject({ creator: { fullName: expect.any(String) } });
  });

  it("korisnik ne može da menja kategoriju, ali može naslov dok je zahtev otvoren", async () => {
    const category = await call(patchTicket, "ana", "PATCH", {
      id: ticketId,
      body: { categoryId: "10000000-0000-4000-8000-000000000002" },
    });
    expect(category.status).toBe(403);
    expect(category.json.error.code).toBe("FORBIDDEN");

    const title = await call(patchTicket, "ana", "PATCH", {
      id: ticketId,
      body: { title: `Ne radi VPN iz kuće ${MARKER}` },
    });
    expect(title.status).toBe(200);
    expect(title.json.title).toBe(`Ne radi VPN iz kuće ${MARKER}`);
  });

  it("agent preuzima zahtev: in_progress, dodeljen njemu", async () => {
    const other = await call(assignTicket, "agent", "POST", {
      id: ticketId,
      body: { assigneeId: USERS.agent2.id },
    });
    expect(other.status).toBe(403);

    const { status, json } = await call(assignTicket, "agent", "POST", {
      id: ticketId,
      body: { assigneeId: USERS.agent.id },
    });
    expect(status).toBe(200);
    expect(json).toMatchObject({
      status: "in_progress",
      assignedTo: USERS.agent.id,
      assignee: { id: USERS.agent.id, role: "agent" },
      permissions: {
        allowedTransitions: ["waiting_on_customer", "resolved"],
        canCommentInternal: true,
        canAssign: false,
        canEdit: true,
      },
    });

    // Drugi agent više ne može da ga preuzme ni da mu menja status.
    const taken = await call(assignTicket, "agent2", "POST", {
      id: ticketId,
      body: { assigneeId: USERS.agent2.id },
    });
    expect(taken.json.error.code).toBe("TICKET_ALREADY_ASSIGNED");
    const notMine = await call(changeStatus, "agent2", "POST", {
      id: ticketId,
      body: { status: "resolved" },
    });
    expect(notMine.status).toBe(403);
    expect(notMine.json.error.code).toBe("NOT_ASSIGNED_AGENT");
  });

  it("interna beleška i javni odgovor; prvi javni odgovor upisuje firstResponseAt", async () => {
    const internal = await call(addComment, "agent", "POST", {
      id: ticketId,
      body: { body: "Interno: proveriti VPN sertifikat.", isInternal: true },
    });
    expect(internal.status).toBe(201);
    expect(internal.json).toMatchObject({ isInternal: true, author: { id: USERS.agent.id } });

    const afterInternal = await call(getTicket, "agent", "GET", { id: ticketId });
    expect(afterInternal.json.firstResponseAt).toBeNull();

    const reply = await call(addComment, "agent", "POST", {
      id: ticketId,
      body: { body: "Da li koristite novi VPN klijent?" },
    });
    expect(reply.status).toBe(201);
    const afterReply = await call(getTicket, "agent", "GET", { id: ticketId });
    expect(afterReply.json.firstResponseAt).not.toBeNull();
  });

  it("korisnik ne vidi internu belešku i ne može da je napiše", async () => {
    const asCustomer = await call(listComments, "ana", "GET", { id: ticketId });
    expect(asCustomer.status).toBe(200);
    expect(asCustomer.json.map((c: { body: string }) => c.body)).toEqual([
      "Da li koristite novi VPN klijent?",
    ]);

    const asAgent = await call(listComments, "agent", "GET", { id: ticketId });
    expect(asAgent.json).toHaveLength(2);

    const attempt = await call(addComment, "ana", "POST", {
      id: ticketId,
      body: { body: "Pokušaj interne beleške", isInternal: true },
    });
    expect(attempt.status).toBe(403);
    expect(attempt.json.error.code).toBe("FORBIDDEN_INTERNAL_COMMENT");
  });

  it("odgovor korisnika vraća zahtev iz waiting_on_customer u in_progress", async () => {
    const waiting = await call(changeStatus, "agent", "POST", {
      id: ticketId,
      body: { status: "waiting_on_customer" },
    });
    expect(waiting.json.status).toBe("waiting_on_customer");

    await call(addComment, "ana", "POST", { id: ticketId, body: { body: "Da, verzija 5.2." } });
    const detail = await call(getTicket, "ana", "GET", { id: ticketId });
    expect(detail.json.status).toBe("in_progress");
  });

  it("korisnik ne može sam da reši zahtev (INVALID_STATUS_TRANSITION)", async () => {
    const { status, json } = await call(changeStatus, "ana", "POST", {
      id: ticketId,
      body: { status: "resolved" },
    });
    expect(status).toBe(409);
    expect(json.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("agent rešava: resolvedAt; korisnik dobija dugmad za ocenu i potvrdu", async () => {
    const resolved = await call(changeStatus, "agent", "POST", {
      id: ticketId,
      body: { status: "resolved" },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.json.resolvedAt).not.toBeNull();

    const asCustomer = await call(getTicket, "ana", "GET", { id: ticketId });
    expect(asCustomer.json.permissions).toMatchObject({
      allowedTransitions: ["closed", "in_progress"],
      canRate: true,
      canEdit: false,
    });
  });

  it("korisnik ocenjuje jednom; agent ne ocenjuje", async () => {
    const byAgent = await call(rateTicket, "agent", "POST", { id: ticketId, body: { score: 5 } });
    expect(byAgent.status).toBe(403);

    const invalid = await call(rateTicket, "ana", "POST", { id: ticketId, body: { score: 6 } });
    expect(invalid.status).toBe(400);
    expect(invalid.json.error.details.fields.score).toBeDefined();

    const rated = await call(rateTicket, "ana", "POST", {
      id: ticketId,
      body: { score: 4, comment: "Rešeno, hvala." },
    });
    expect(rated.status).toBe(201);
    expect(rated.json).toMatchObject({
      score: 4,
      comment: "Rešeno, hvala.",
      ratedBy: USERS.ana.id,
    });

    const again = await call(rateTicket, "ana", "POST", { id: ticketId, body: { score: 5 } });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("ALREADY_RATED");

    const detail = await call(getTicket, "ana", "GET", { id: ticketId });
    expect(detail.json.rating).toMatchObject({ score: 4 });
    expect(detail.json.permissions.canRate).toBe(false);
  });

  it("korisnik potvrđuje rešenje: closedAt; zatvoren zahtev se ne komentariše", async () => {
    const closed = await call(changeStatus, "ana", "POST", {
      id: ticketId,
      body: { status: "closed" },
    });
    expect(closed.status).toBe(200);
    expect(closed.json).toMatchObject({ status: "closed" });
    expect(closed.json.closedAt).not.toBeNull();
    expect(closed.json.resolvedAt).not.toBeNull();
    expect(closed.json.permissions).toMatchObject({
      allowedTransitions: [],
      canComment: false,
      canEdit: false,
    });

    const comment = await call(addComment, "ana", "POST", {
      id: ticketId,
      body: { body: "Još jedno pitanje" },
    });
    expect(comment.status).toBe(409);
    expect(comment.json.error.code).toBe("TICKET_CLOSED");
  });

  it("admin ponovo otvara zatvoren zahtev: brišu se resolvedAt i closedAt", async () => {
    const reopened = await call(changeStatus, "admin", "POST", {
      id: ticketId,
      body: { status: "open" },
    });
    expect(reopened.status).toBe(200);
    expect(reopened.json).toMatchObject({ status: "open", resolvedAt: null, closedAt: null });
    expect(reopened.json.firstResponseAt).not.toBeNull();
  });

  it("istorija sadrži ceo tok sa imenima, a automatski prelaz bez aktera", async () => {
    const { status, json } = await call(getHistory, "ana", "GET", { id: ticketId });
    expect(status).toBe(200);
    const actions = json.map((entry: { action: string }) => entry.action);
    expect(actions[0]).toBe("created");
    expect(actions).toEqual(
      expect.arrayContaining(["updated", "assigned", "status_changed", "rated"]),
    );

    const assigned = json.find((entry: { action: string }) => entry.action === "assigned");
    expect(assigned).toMatchObject({
      actor: { id: USERS.agent.id },
      assignee: { id: USERS.agent.id },
    });

    // Odgovor korisnika na waiting_on_customer: sistemski prelaz (actor = null).
    const automatic = json.find(
      (entry: { action: string; actor: unknown; newValue: { status?: string } | null }) =>
        entry.action === "status_changed" && entry.actor === null,
    );
    expect(automatic).toMatchObject({
      oldValue: { status: "waiting_on_customer" },
      newValue: { status: "in_progress" },
    });
  });

  it("korisnik u svojoj listi ne dobija tuđe zahteve", async () => {
    const { json } = await call(listTickets, "marko", "GET", { query: { q: MARKER } });
    expect(json.items).toEqual([]);
    expect(json.total).toBe(0);
  });
});

describe("GET /api/tickets: filteri i paginacija", () => {
  it("korisnik vidi samo svoje zahteve", async () => {
    const { status, json } = await call(listTickets, "marko", "GET", {
      query: { pageSize: "100" },
    });
    expect(status).toBe(200);
    expect(json.items.length).toBeGreaterThan(0);
    for (const item of json.items) expect(item.creator.id).toBe(USERS.marko.id);
  });

  it("paginacija vraća traženu veličinu i ukupan broj; stranica posle poslednje je prazna", async () => {
    const first = await call(listTickets, "admin", "GET", { query: { pageSize: "2" } });
    expect(first.json).toMatchObject({ page: 1, pageSize: 2 });
    expect(first.json.items).toHaveLength(2);
    expect(first.json.total).toBeGreaterThanOrEqual(12);

    const beyond = await call(listTickets, "admin", "GET", {
      query: { page: "999", pageSize: "50" },
    });
    expect(beyond.status).toBe(200);
    expect(beyond.json).toMatchObject({ items: [], page: 999, total: first.json.total });
  });

  it("filter po statusu i pretraga po broju (#1001)", async () => {
    const resolved = await call(listTickets, "agent", "GET", { query: { status: "resolved" } });
    for (const item of resolved.json.items) expect(item.status).toBe("resolved");

    const byNumber = await call(listTickets, "agent", "GET", { query: { q: "#1001" } });
    expect(byNumber.json.items.map((item: { number: number }) => item.number)).toEqual([1001]);
  });

  it("sortiranje po prioritetu (najhitniji prvo)", async () => {
    const { json } = await call(listTickets, "admin", "GET", {
      query: { sort: "-priority", pageSize: "100" },
    });
    const order = ["low", "medium", "high", "urgent"];
    const ranks = json.items.map((item: { priority: string }) => order.indexOf(item.priority));
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });

  it("neispravan filter vraća 400 sa greškom po polju", async () => {
    const { status, json } = await call(listTickets, "agent", "GET", {
      query: { status: "nepostoji" },
    });
    expect(status).toBe(400);
    expect(json.error.details.fields.status).toBeDefined();
  });
});

describe("kategorije i agenti", () => {
  it("svi prijavljeni vide aktivne kategorije; neaktivne samo admin", async () => {
    const active = await call(getCategories, "ana", "GET");
    expect(active.status).toBe(200);
    expect(active.json.length).toBeGreaterThanOrEqual(5);
    expect(active.json[0]).toMatchObject({ slug: "technical", nameSr: "Tehnički problem" });

    const forbidden = await call(getCategories, "ana", "GET", {
      query: { includeInactive: "true" },
    });
    expect(forbidden.status).toBe(403);

    const all = await call(getCategories, "admin", "GET", { query: { includeInactive: "true" } });
    expect(all.status).toBe(200);
  });

  it("spisak agenata: tim vidi, korisnik ne", async () => {
    const forCustomer = await call(getAgents, "ana", "GET");
    expect(forCustomer.status).toBe(403);

    const { status, json } = await call(getAgents, "agent", "GET");
    expect(status).toBe(200);
    const ids = json.map((member: { id: string }) => member.id);
    expect(ids).toEqual(expect.arrayContaining([USERS.agent.id, USERS.agent2.id, USERS.admin.id]));
    expect(ids).not.toContain(USERS.ana.id);
    expect(json[0].openAssignedCount).toEqual(expect.any(Number));
  });
});

describe("demo zahtevi iz seed.sql", () => {
  it("korisnik vidi seed zahtev #1001 bez interne beleške", async () => {
    const id = "20000000-0000-4000-8000-000000000001";
    const detail = await call(getTicket, "ana", "GET", { id });
    expect(detail.status).toBe(200);
    expect(detail.json.number).toBe(1001);

    const comments = await call(listComments, "ana", "GET", { id });
    expect(comments.json.every((c: { isInternal: boolean }) => !c.isInternal)).toBe(true);
    const staffComments = await call(listComments, "agent", "GET", { id });
    expect(staffComments.json.some((c: { isInternal: boolean }) => c.isInternal)).toBe(true);
  });
});
