/**
 * Unit testovi: withApi (src/lib/api/with-api.ts).
 *
 * Proverava kriterijume Faze 3 (docs/07): 401 bez sesije, 403 za pogrešnu
 * ulogu, 400 sa greškama po poljima za neispravan ulaz, kao i oblik
 * uspešnog odgovora i jedinstvenu obradu grešaka. Provera prijave
 * (auth-guard) je ovde zamenjena lažnom (mock), jer se testira samo omotač;
 * sama provera prijave ima svoje testove (auth-guard.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AuthContext } from "@/lib/auth/auth-context";
import { AppError } from "@/lib/errors/app-error";

// Lažna provera prijave: svaki test bira šta requireRole vraća ili baca.
const requireRole = vi.fn();
vi.mock("@/lib/auth/auth-guard", () => ({
  createRequestClient: vi.fn(async () => ({ db: {}, accessToken: null })),
  requireRole: (...args: unknown[]) => requireRole(...args),
}));
// Lažni real-time publisher (ne šalje ništa).
vi.mock("@/lib/realtime", () => ({ getRealtimePublisher: () => ({ publish: vi.fn() }) }));

const { withApi } = await import("@/lib/api/with-api");

/** Parametri putanje kakve Next.js prosleđuje ruti. */
function routeContext(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) };
}

/** POST zahtev sa JSON telom. */
function postJson(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Agent koji je "prijavljen" u testovima. */
const agent = new AuthContext("00000000-0000-4000-8000-000000000002", "agent", "sr");

beforeEach(() => {
  requireRole.mockReset();
});

describe("withApi: prijava i uloga", () => {
  // Bez sesije: requireRole baca UNAUTHENTICATED -> 401.
  it("vraća 401 bez sesije", async () => {
    requireRole.mockRejectedValue(new AppError("UNAUTHENTICATED"));
    const route = withApi({ roles: ["customer"] }, async () => ({ ok: true }));

    const response = await route(new Request("http://localhost/api/test"), routeContext());
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  // Pogrešna uloga: requireRole baca FORBIDDEN -> 403.
  it("vraća 403 za pogrešnu ulogu", async () => {
    requireRole.mockRejectedValue(new AppError("FORBIDDEN"));
    const route = withApi({ roles: ["admin"] }, async () => ({ ok: true }));

    const response = await route(new Request("http://localhost/api/test"), routeContext());
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  // Dozvoljena uloga: ruta dobija ServiceContext sa korisnikom.
  it("prosleđuje ServiceContext ruti", async () => {
    requireRole.mockResolvedValue(agent);
    const route = withApi({ roles: ["agent", "admin"] }, async ({ ctx }) => ({
      userId: ctx.auth.userId,
      staff: ctx.auth.isStaff(),
    }));

    const response = await route(new Request("http://localhost/api/test"), routeContext());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: agent.userId, staff: true });
    expect(requireRole).toHaveBeenCalledWith(expect.anything(), ["agent", "admin"]);
  });

  // Javna ruta: nema provere prijave, ctx je null.
  it("javna ruta radi bez prijave", async () => {
    const route = withApi({ roles: "public" }, async ({ ctx }) => ({ ctx }));

    const response = await route(new Request("http://localhost/api/test"), routeContext());
    expect(await response.json()).toEqual({ ctx: null });
    expect(requireRole).not.toHaveBeenCalled();
  });
});

describe("withApi: provera ulaza (Zod)", () => {
  const bodySchema = z.object({ title: z.string().min(5), priority: z.enum(["low", "high"]) });

  // Neispravno telo -> 400 VALIDATION_ERROR sa greškama po poljima.
  it("vraća 400 sa listom polja za neispravan ulaz", async () => {
    requireRole.mockResolvedValue(agent);
    const route = withApi({ roles: ["agent"], body: bodySchema }, async ({ body }) => body);

    const response = await route(postJson({ title: "abc", priority: "x" }), routeContext());
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(json.error.details.fields)).toEqual(["title", "priority"]);
  });

  // Neispravan JSON nije 500 nego 400.
  it("vraća 400 za neispravan JSON", async () => {
    requireRole.mockResolvedValue(agent);
    const route = withApi({ roles: ["agent"], body: bodySchema }, async ({ body }) => body);

    const response = await route(postJson("{ne-json"), routeContext());
    expect(response.status).toBe(400);
    expect((await response.json()).error.details).toEqual({ reason: "INVALID_JSON" });
  });

  // Ispravan ulaz: ruta dobija proverene podatke (telo, query, parametre putanje).
  it("prosleđuje proverene podatke", async () => {
    requireRole.mockResolvedValue(agent);
    const route = withApi(
      {
        roles: ["agent"],
        body: bodySchema,
        query: z.object({ page: z.coerce.number().int().min(1) }),
        params: z.object({ id: z.uuid() }),
        successStatus: 201,
      },
      async ({ body, query, params }) => ({ body, query, params }),
    );

    const id = "10000000-0000-4000-8000-000000000001";
    const request = new Request("http://localhost/api/test?page=2", {
      method: "POST",
      body: JSON.stringify({ title: "Naslov zahteva", priority: "high" }),
    });
    const response = await route(request, routeContext({ id }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      body: { title: "Naslov zahteva", priority: "high" },
      query: { page: 2 },
      params: { id },
    });
  });
});

describe("withApi: odgovori i greške", () => {
  // Ruta bez rezultata -> 204 No Content.
  it("vraća 204 kad ruta ne vrati ništa", async () => {
    requireRole.mockResolvedValue(agent);
    const route = withApi({ roles: ["agent"] }, async () => undefined);

    const response = await route(new Request("http://localhost/api/test"), routeContext());
    expect(response.status).toBe(204);
  });

  // AppError iz servisa zadržava svoj kod i status.
  it("AppError iz servisa vraća svoj status", async () => {
    requireRole.mockResolvedValue(agent);
    const route = withApi({ roles: ["agent"] }, async () => {
      throw new AppError("INVALID_STATUS_TRANSITION");
    });

    const response = await route(new Request("http://localhost/api/test"), routeContext());
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  // Neočekivana greška -> 500 INTERNAL_ERROR, bez detalja za klijenta.
  it("neočekivana greška vraća 500 bez detalja", async () => {
    requireRole.mockResolvedValue(agent);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const route = withApi({ roles: ["agent"] }, async () => {
      throw new Error("tajna poruka iz baze");
    });

    const response = await route(new Request("http://localhost/api/test"), routeContext());
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(json)).not.toContain("tajna");
  });

  // Poruka greške je na jeziku iz Accept-Language.
  it("poruka greške prati Accept-Language", async () => {
    requireRole.mockRejectedValue(new AppError("UNAUTHENTICATED"));
    const route = withApi({ roles: ["agent"] }, async () => ({}));

    const en = await route(
      new Request("http://localhost/api/test", {
        headers: { "Accept-Language": "en-US,en;q=0.9" },
      }),
      routeContext(),
    );
    expect((await en.json()).error.message).toBe("You need to sign in.");

    const sr = await route(new Request("http://localhost/api/test"), routeContext());
    expect((await sr.json()).error.message).toBe("Potrebno je da se prijavite.");
  });
});
