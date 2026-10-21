/**
 * Integracioni testovi: API analitike (Faza 8, UC-23) nad pravim lokalnim
 * Supabase-om:
 *   - GET /api/analytics/overview, /by-dimension, /agents, /trend
 *
 * Tačni brojevi: test upisuje pet zahteva sa POZNATIM vremenima u mart 2020.
 * (period u kome nema drugih podataka), pa za taj period zna tačan rezultat
 * svake funkcije. Jedan zahtev je kreiran 31.3. u 22:30 UTC, što je već
 * 1.4. po beogradskom vremenu (letnje vreme), a drugi 29.2. u 23:30 UTC, što je
 * 1.3. u Beogradu — tako se proverava da se period računa po beogradskoj zoni.
 * Kriterijum iz docs/07: agent i korisnik dobijaju 403 na svim rutama
 * /api/analytics/*; isto i baza (RPC poziv mimo API-ja daje FORBIDDEN).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET as getAgents } from "@/app/api/analytics/agents/route";
import { GET as getByDimension } from "@/app/api/analytics/by-dimension/route";
import { GET as getOverview } from "@/app/api/analytics/overview/route";
import { GET as getTrend } from "@/app/api/analytics/trend/route";
import type { RouteHandler } from "@/lib/api/with-api";
import {
  agentStatsSchema,
  analyticsOverviewSchema,
  countItemSchema,
  trendPointSchema,
} from "@/lib/validation/analytics";
import { as, expectDbError, serviceClient, USERS, type SeedUser } from "./helpers";

/** Kategorije iz seed.sql. */
const CATEGORY = {
  technical: "10000000-0000-4000-8000-000000000001",
  account: "10000000-0000-4000-8000-000000000002",
  billing: "10000000-0000-4000-8000-000000000003",
  other: "10000000-0000-4000-8000-000000000005",
};

/** ID test zahteva (opseg ...-8020-..., briše se posle testa). */
const ticketId = (n: number) => `00000000-0000-4000-8020-00000000000${n}`;

/** Svi ID-jevi test zahteva. */
const TEST_TICKET_IDS = [1, 2, 3, 4, 5].map(ticketId);

/** Period testa: ceo mart 2020. po beogradskom vremenu. */
const MARCH = { from: "2020-03-01", to: "2020-03-31" };

/** Pristupni tokeni demo naloga. */
const tokens: Partial<Record<SeedUser, string>> = {};

beforeAll(async () => {
  // Korak 1: prijava naloga koji pozivaju rute.
  for (const user of ["ana", "agent", "admin"] as const) {
    const client = await as(user);
    const { data } = await client.auth.getSession();
    if (!data.session) throw new Error(`Nema sesije za ${user}`);
    tokens[user] = data.session.access_token;
  }

  // Korak 2: zahtevi sa poznatim vremenima (service_role, samo za pripremu).
  const db = serviceClient();
  await db.from("tickets").delete().in("id", TEST_TICKET_IDS);
  const base = { description: "Zahtev za test analitike.", created_by: USERS.ana.id };
  const { error } = await db.from("tickets").insert([
    // T1: rešen za 240 min (prvi odgovor 30 min), pa zatvoren; ocena 5.
    {
      ...base,
      id: ticketId(1),
      title: "Analitika T1",
      status: "closed",
      priority: "high",
      category_id: CATEGORY.technical,
      assigned_to: USERS.agent.id,
      created_at: "2020-03-02T09:00:00Z",
      first_response_at: "2020-03-02T09:30:00Z",
      resolved_at: "2020-03-02T13:00:00Z",
      closed_at: "2020-03-04T10:00:00Z",
    },
    // T2: rešen za 2880 min (prvi odgovor 90 min); ocena 3.
    {
      ...base,
      id: ticketId(2),
      title: "Analitika T2",
      status: "resolved",
      priority: "medium",
      category_id: CATEGORY.account,
      assigned_to: USERS.agent2.id,
      created_at: "2020-03-03T10:00:00Z",
      first_response_at: "2020-03-03T11:30:00Z",
      resolved_at: "2020-03-05T10:00:00Z",
    },
    // T3: u obradi (prvi odgovor 60 min), nije rešen.
    {
      ...base,
      id: ticketId(3),
      title: "Analitika T3",
      status: "in_progress",
      priority: "low",
      category_id: CATEGORY.billing,
      assigned_to: USERS.agent.id,
      created_at: "2020-03-10T08:00:00Z",
      first_response_at: "2020-03-10T09:00:00Z",
    },
    // T4: 31.3. 22:30 UTC = 1.4. 00:30 u Beogradu -> VAN marta.
    {
      ...base,
      id: ticketId(4),
      title: "Analitika T4",
      status: "open",
      priority: "urgent",
      category_id: CATEGORY.technical,
      created_at: "2020-03-31T22:30:00Z",
    },
    // T5: 29.2. 23:30 UTC = 1.3. 00:30 u Beogradu -> U martu; korisnik ga otkazao.
    {
      ...base,
      id: ticketId(5),
      title: "Analitika T5",
      status: "closed",
      priority: "low",
      category_id: CATEGORY.other,
      created_at: "2020-02-29T23:30:00Z",
      closed_at: "2020-03-01T05:00:00Z",
    },
  ]);
  if (error) throw new Error(error.message);
  const ratings = await db.from("ticket_ratings").insert([
    {
      ticket_id: ticketId(1),
      rated_by: USERS.ana.id,
      score: 5,
      created_at: "2020-03-03T08:00:00Z",
    },
    {
      ticket_id: ticketId(2),
      rated_by: USERS.ana.id,
      score: 3,
      created_at: "2020-03-06T08:00:00Z",
    },
  ]);
  if (ratings.error) throw new Error(ratings.error.message);
});

afterAll(async () => {
  // Brisanje test zahteva (ocene se brišu kaskadno).
  await serviceClient().from("tickets").delete().in("id", TEST_TICKET_IDS);
});

/** Poziva rutu u ime demo naloga; vraća status i JSON telo. */
async function call(route: RouteHandler, user: SeedUser, query: Record<string, string>) {
  const url = new URL("http://localhost/api/test");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const headers = { Authorization: `Bearer ${tokens[user]}` };
  const response = await route(new Request(url, { headers }), { params: Promise.resolve({}) });
  const text = await response.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- telo odgovora se proverava u testu
  const json: any = text ? JSON.parse(text) : undefined;
  return { status: response.status, json };
}

describe("API analitike: tačni brojevi za poznat period", () => {
  it("overview: kreirani, rešeni, zatvoreni, prosečna vremena i CSAT", async () => {
    const { status, json } = await call(getOverview, "admin", MARCH);
    expect(status).toBe(200);
    expect(analyticsOverviewSchema.safeParse(json).success).toBe(true);
    expect(json).toMatchObject({
      from: "2020-03-01",
      to: "2020-03-31",
      createdCount: 4, // T1, T2, T3, T5 (T4 je po Beogradu u aprilu)
      resolvedCount: 2, // T1, T2
      closedCount: 2, // T1, T5
      avgFirstResponseMinutes: 60, // (30 + 90 + 60) / 3
      avgResolutionMinutes: 1560, // (240 + 2880) / 2
      csat: {
        average: 4,
        count: 2,
        distribution: [
          { score: 1, count: 0 },
          { score: 2, count: 0 },
          { score: 3, count: 1 },
          { score: 4, count: 0 },
          { score: 5, count: 1 },
        ],
      },
    });
    // Trenutno otvoreni ne zavise od perioda (bar T3 i T4).
    expect(json.openCount).toBeGreaterThanOrEqual(2);
  });

  it("by-dimension: sve vrednosti, i one sa nulom; kategorije sa nazivima", async () => {
    const byStatus = await call(getByDimension, "admin", { ...MARCH, dimension: "status" });
    expect(byStatus.status).toBe(200);
    expect(byStatus.json.every((item: unknown) => countItemSchema.safeParse(item).success)).toBe(
      true,
    );
    expect(
      byStatus.json.map((item: { key: string; total: number }) => [item.key, item.total]),
    ).toEqual([
      ["open", 0],
      ["in_progress", 1],
      ["waiting_on_customer", 0],
      ["resolved", 1],
      ["closed", 2],
    ]);

    const byCategory = await call(getByDimension, "admin", { ...MARCH, dimension: "category" });
    const totals = Object.fromEntries(
      byCategory.json.map((item: { nameSr: string; total: number }) => [item.nameSr, item.total]),
    );
    expect(totals).toMatchObject({
      "Tehnički problem": 1,
      "Nalog i prijava": 1,
      Naplata: 1,
      "Zahtev za funkcionalnost": 0,
      Ostalo: 1,
    });

    const byPriority = await call(getByDimension, "admin", { ...MARCH, dimension: "priority" });
    expect(byPriority.json.map((item: { total: number }) => item.total)).toEqual([2, 1, 1, 0]);
  });

  it("agents: dodeljeno, rešeno, vreme rešavanja i ocena po agentu", async () => {
    const { status, json } = await call(getAgents, "admin", MARCH);
    expect(status).toBe(200);
    expect(json.every((item: unknown) => agentStatsSchema.safeParse(item).success)).toBe(true);
    const byId = Object.fromEntries(json.map((item: { agentId: string }) => [item.agentId, item]));
    expect(byId[USERS.agent.id]).toMatchObject({
      assignedCount: 2,
      resolvedCount: 1,
      avgResolutionMinutes: 240,
      avgRating: 5,
      ratingCount: 1,
    });
    expect(byId[USERS.agent2.id]).toMatchObject({
      assignedCount: 1,
      resolvedCount: 1,
      avgResolutionMinutes: 2880,
      avgRating: 3,
      ratingCount: 1,
    });
  });

  it("trend po danu: svaki dan u martu, i dani bez zahteva", async () => {
    const { status, json } = await call(getTrend, "admin", MARCH);
    expect(status).toBe(200);
    expect(json).toHaveLength(31);
    expect(json.every((item: unknown) => trendPointSchema.safeParse(item).success)).toBe(true);
    const byDay = Object.fromEntries(
      json.map((point: { bucketStart: string; createdCount: number; resolvedCount: number }) => [
        point.bucketStart,
        [point.createdCount, point.resolvedCount],
      ]),
    );
    expect(byDay["2020-03-01"]).toEqual([1, 0]); // T5 (po Beogradu)
    expect(byDay["2020-03-02"]).toEqual([1, 1]); // T1 kreiran i rešen
    expect(byDay["2020-03-05"]).toEqual([0, 1]); // T2 rešen
    expect(byDay["2020-03-31"]).toEqual([0, 0]); // T4 je već u aprilu
  });

  it("trend po nedelji: nedelje počinju ponedeljkom", async () => {
    const { json } = await call(getTrend, "admin", { ...MARCH, bucket: "week" });
    expect(
      json.map((point: { bucketStart: string; createdCount: number; resolvedCount: number }) => [
        point.bucketStart,
        point.createdCount,
        point.resolvedCount,
      ]),
    ).toEqual([
      ["2020-02-24", 1, 0], // nedelja 1.3. pripada nedelji od ponedeljka 24.2.
      ["2020-03-02", 2, 2],
      ["2020-03-09", 1, 0],
      ["2020-03-16", 0, 0],
      ["2020-03-23", 0, 0],
      ["2020-03-30", 0, 0],
    ]);
  });
});

describe("API analitike: pristup i provera ulaza", () => {
  /** Sve četiri rute sa ispravnim parametrima. */
  const routes: [string, RouteHandler, Record<string, string>][] = [
    ["overview", getOverview, {}],
    ["by-dimension", getByDimension, { dimension: "status" }],
    ["agents", getAgents, {}],
    ["trend", getTrend, {}],
  ];

  it.each(routes)("%s: agent i korisnik dobijaju 403", async (_name, route, query) => {
    for (const user of ["agent", "ana"] as const) {
      const { status, json } = await call(route, user, query);
      expect(status).toBe(403);
      expect(json.error.code).toBe("FORBIDDEN");
    }
  });

  it("baza odbija analitiku i kad se zaobiđe API (RPC kao agent)", async () => {
    const agent = await as("agent");
    await expectDbError(
      agent.rpc("analytics_overview", { p_from: "2020-03-01", p_to: "2020-03-31" }),
      "FORBIDDEN",
    );
  });

  it("bez perioda: poslednjih 30 dana", async () => {
    const { status, json } = await call(getOverview, "admin", {});
    expect(status).toBe(200);
    const days = (Date.parse(json.to) - Date.parse(json.from)) / 86_400_000 + 1;
    expect(days).toBe(30);
  });

  it("neispravan period i parametri daju 400", async () => {
    // „od“ posle „do“, duže od 366 dana, loš datum, nepoznata dimenzija i interval.
    const invalid: Record<string, string>[] = [
      { from: "2020-03-31", to: "2020-03-01" },
      { from: "2019-01-01", to: "2020-03-01" },
      { from: "2020-02-30" },
    ];
    for (const query of invalid) {
      expect((await call(getOverview, "admin", query)).status).toBe(400);
    }
    expect((await call(getByDimension, "admin", { dimension: "agent" })).status).toBe(400);
    expect((await call(getTrend, "admin", { bucket: "month" })).status).toBe(400);
  });
});
