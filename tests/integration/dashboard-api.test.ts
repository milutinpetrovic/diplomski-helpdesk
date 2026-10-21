/**
 * Integracioni testovi: GET /api/dashboard (Faza 6, UC-25) nad pravim
 * lokalnim Supabase-om, za sve tri uloge.
 *
 * Kriterijum iz docs/07: svaka uloga vidi svoj panel sa TAČNIM brojevima.
 * Očekivani brojevi se ovde računaju nezavisno — čitanjem tabela tickets i
 * ticket_ratings kao isti korisnik (RLS) i brojanjem u testu — pa se porede
 * sa onim što vraća API (SQL funkcije ticket_counts i agent_dashboard_stats).
 * Tako test važi i kad drugi testovi u bazu dodaju zahteve.
 * Proverava se i da korisnik ne broji niti vidi tuđe zahteve, i da novi
 * zahtev odmah menja brojeve.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as listTickets, POST as createTicket } from "@/app/api/tickets/route";
import type { RouteHandler } from "@/lib/api/with-api";
import { as, CATEGORY_ID, USERS, type DbClient, type SeedUser } from "./helpers";

/** Statusi koji znače da zahtev još nije rešen. */
const UNRESOLVED = ["open", "in_progress", "waiting_on_customer"];

/** Pristupni tokeni i klijenti demo naloga. */
const tokens: Partial<Record<SeedUser, string>> = {};
const clients: Partial<Record<SeedUser, DbClient>> = {};

beforeAll(async () => {
  for (const user of ["ana", "marko", "agent", "admin"] as const) {
    const client = await as(user);
    const { data } = await client.auth.getSession();
    if (!data.session) throw new Error(`Nema sesije za ${user}`);
    tokens[user] = data.session.access_token;
    clients[user] = client;
  }
});

/** Poziva rutu u ime demo naloga; vraća status i JSON telo. */
async function call(
  route: RouteHandler,
  user: SeedUser,
  method = "GET",
  body?: unknown,
  query: Record<string, string> = {},
) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${tokens[user]}` };
  const url = new URL("http://localhost/api/test");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await route(
    new Request(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );
  const text = await response.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- telo odgovora se proverava u testu
  const json: any = text ? JSON.parse(text) : undefined;
  return { status: response.status, json };
}

/** Zahtevi koje korisnik vidi (RLS), za nezavisno brojanje. */
async function visibleTickets(user: SeedUser) {
  const { data, error } = await clients[user]!.from("tickets").select(
    "id, number, status, priority, assigned_to, created_by, updated_at",
  );
  if (error) throw error;
  return data;
}

/** Broj zahteva po statusu iz spiska. */
function countByStatus(tickets: { status: string }[]) {
  const counts: Record<string, number> = {
    open: 0,
    in_progress: 0,
    waiting_on_customer: 0,
    resolved: 0,
    closed: 0,
  };
  for (const ticket of tickets) counts[ticket.status]! += 1;
  return counts;
}

describe("GET /api/dashboard", () => {
  it("korisnik: svoji zahtevi po statusu i liste samo sa svojim zahtevima", async () => {
    const { status, json } = await call(getDashboard, "ana");
    expect(status).toBe(200);
    expect(json.kind).toBe("customer");

    // Brojevi se poklapaju sa nezavisnim brojanjem; svi vidljivi zahtevi su Anini.
    const mine = await visibleTickets("ana");
    expect(mine.every((ticket) => ticket.created_by === USERS.ana.id)).toBe(true);
    expect(json.statusCounts).toEqual(countByStatus(mine));

    // Liste sadrže samo Anine zahteve u odgovarajućem statusu.
    const ids = new Set(mine.map((ticket) => ticket.id));
    for (const list of ["waitingOnMe", "toRate", "recent"]) {
      expect(json[list].length).toBeLessThanOrEqual(5);
      for (const ticket of json[list]) expect(ids.has(ticket.id)).toBe(true);
    }
    for (const ticket of json.waitingOnMe) expect(ticket.status).toBe("waiting_on_customer");

    // Liste odgovaraju nezavisnom računanju (poslednje menjani prvi, najviše 5).
    // Drugi testovi dodaju Ani zahteve, pa se ne oslanjamo samo na seed.
    const newestFirst = (a: { updated_at: string }, b: { updated_at: string }) =>
      b.updated_at.localeCompare(a.updated_at);
    const waiting = mine.filter((t) => t.status === "waiting_on_customer").sort(newestFirst);
    expect(json.waitingOnMe.map((t: { id: string }) => t.id)).toEqual(
      waiting.slice(0, 5).map((t) => t.id),
    );
    const { data: ratings } = await clients.ana!.from("ticket_ratings").select("ticket_id");
    const rated = new Set((ratings ?? []).map((r) => r.ticket_id));
    const unrated = mine
      .filter((t) => ["resolved", "closed"].includes(t.status) && !rated.has(t.id))
      .sort(newestFirst);
    const toRate = json.toRate.map((t: { id: string }) => t.id);
    expect(toRate).toEqual(unrated.slice(0, 5).map((t) => t.id));
    // Seed: #1005 je već ocenjen, pa nikad nije u „Ocenite rešenje“.
    expect(json.toRate.map((t: { number: number }) => t.number)).not.toContain(1005);
  });

  it("korisnik ne broji tuđe zahteve: Markov novi zahtev ne menja Anin panel", async () => {
    const before = await call(getDashboard, "ana");
    const markoBefore = await call(getDashboard, "marko");

    const created = await call(createTicket, "marko", "POST", {
      title: "Panel test: novi zahtev",
      description: "Zahtev napravljen u testu kontrolnog panela.",
      categoryId: CATEGORY_ID,
      priority: "urgent",
    });
    expect(created.status).toBe(201);

    const after = await call(getDashboard, "ana");
    const markoAfter = await call(getDashboard, "marko");
    expect(after.json.statusCounts).toEqual(before.json.statusCounts);
    expect(markoAfter.json.statusCounts.open).toBe(markoBefore.json.statusCounts.open + 1);
    expect(markoAfter.json.recent[0].id).toBe(created.json.id);
  });

  it("agent: svoji zahtevi, red nedodeljenih, hitni i lična ocena", async () => {
    const { status, json } = await call(getDashboard, "agent");
    expect(status).toBe(200);
    expect(json.kind).toBe("agent");

    // Nezavisno brojanje iz tabele (agent vidi sve zahteve).
    const all = await visibleTickets("agent");
    const me = USERS.agent.id;
    expect(json.myStatusCounts).toEqual(countByStatus(all.filter((t) => t.assigned_to === me)));
    const unresolved = all.filter((t) => UNRESOLVED.includes(t.status));
    expect(json.unassignedCount).toBe(unresolved.filter((t) => t.assigned_to === null).length);
    expect(json.urgentCount).toBe(unresolved.filter((t) => t.priority === "urgent").length);
    expect(json.resolvedCount).toBe(
      all.filter((t) => t.assigned_to === me && ["resolved", "closed"].includes(t.status)).length,
    );

    // Red čekanja: samo nedodeljeni nerešeni, najstariji prvo; hitni: samo urgent.
    for (const ticket of json.unassignedQueue) expect(UNRESOLVED).toContain(ticket.status);
    const created = json.unassignedQueue.map((t: { createdAt: string }) => t.createdAt);
    expect([...created].sort()).toEqual(created);
    for (const ticket of json.urgent) expect(ticket.priority).toBe("urgent");

    // Ocena: prosek ocena zahteva dodeljenih agentu.
    const mineIds = all.filter((t) => t.assigned_to === me).map((t) => t.id);
    const { data: ratings } = await clients
      .agent!.from("ticket_ratings")
      .select("score")
      .in("ticket_id", mineIds);
    const scores = (ratings ?? []).map((r) => r.score);
    expect(json.rating.count).toBe(scores.length);
    if (scores.length === 0) expect(json.rating.average).toBeNull();
    else
      expect(json.rating.average).toBeCloseTo(
        scores.reduce((sum, s) => sum + s, 0) / scores.length,
        2,
      );
  });

  it("admin: ukupni brojevi i opterećenje po agentu", async () => {
    const { status, json } = await call(getDashboard, "admin");
    expect(status).toBe(200);
    expect(json.kind).toBe("admin");

    const all = await visibleTickets("admin");
    const unresolved = all.filter((t) => UNRESOLVED.includes(t.status));
    expect(json.statusCounts).toEqual(countByStatus(all));
    expect(json.openCount).toBe(unresolved.length);
    expect(json.unassignedCount).toBe(unresolved.filter((t) => t.assigned_to === null).length);
    expect(json.urgentCount).toBe(unresolved.filter((t) => t.priority === "urgent").length);

    // Opterećenje: za svakog člana tima broj nerešenih dodeljenih; najopterećeniji prvi.
    for (const member of json.workload) {
      expect(member.openAssignedCount).toBe(
        unresolved.filter((t) => t.assigned_to === member.id).length,
      );
    }
    const loads = json.workload.map((m: { openAssignedCount: number }) => m.openAssignedCount);
    expect([...loads].sort((a, b) => b - a)).toEqual(loads);
  });

  it("brojevi sa panela vode na listu sa istim brojem zahteva (status=unresolved)", async () => {
    const { json } = await call(getDashboard, "admin");
    const page = (query: Record<string, string>) =>
      call(listTickets, "admin", "GET", undefined, { ...query, pageSize: "100" });

    const open = await page({ status: "unresolved" });
    expect(open.json.total).toBe(json.openCount);
    for (const ticket of open.json.items) expect(UNRESOLVED).toContain(ticket.status);
    expect((await page({ status: "unresolved", assigneeId: "unassigned" })).json.total).toBe(
      json.unassignedCount,
    );
    expect((await page({ status: "unresolved", priority: "urgent" })).json.total).toBe(
      json.urgentCount,
    );
  });

  it("agent_dashboard_stats je samo za tim podrške (korisnik dobija FORBIDDEN)", async () => {
    const { error } = await clients.ana!.rpc("agent_dashboard_stats");
    expect(error?.message).toBe("FORBIDDEN");
  });
});
