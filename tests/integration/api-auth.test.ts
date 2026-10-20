/**
 * Integracioni testovi: prijava preko `Authorization: Bearer <JWT>` u API rutama.
 *
 * Isto što radi Swagger dugme „Authorize“ i Postman: pravi pristupni token
 * demo naloga iz lokalnog Supabase-a šalje se ruti napravljenoj sa withApi.
 * Proverava ceo lanac: withApi -> AuthGuard -> Supabase Auth -> tabela
 * profiles (uloga) -> RLS (upiti u ime korisnika).
 */
import { describe, expect, it } from "vitest";

import { withApi } from "@/lib/api/with-api";
import { as, USERS } from "./helpers";

/** Test ruta: vraća ko je prijavljen i koliko zahteva vidi (kroz RLS). */
const whoAmI = withApi({ roles: ["customer", "agent", "admin"] }, async ({ ctx }) => {
  const { count } = await ctx.db.from("tickets").select("id", { count: "exact", head: true });
  return { userId: ctx.auth.userId, role: ctx.auth.role, visibleTickets: count };
});

/** Test ruta dostupna samo adminu. */
const adminOnly = withApi({ roles: ["admin"] }, async () => ({ ok: true }));

/** Poziva rutu sa Bearer tokenom (ili bez njega). */
function call(route: typeof whoAmI, token?: string) {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return route(new Request("http://localhost/api/test", { headers }), {
    params: Promise.resolve({}),
  });
}

/** Pristupni token (JWT) prijavljenog demo naloga. */
async function tokenOf(user: "ana" | "agent" | "admin"): Promise<string> {
  const client = await as(user);
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error(`Nema sesije za ${user}`);
  return data.session.access_token;
}

describe("withApi + Bearer token", () => {
  // Korisnik sa važećim tokenom: prava uloga iz baze.
  it("prepoznaje korisnika i njegovu ulogu", async () => {
    const response = await call(whoAmI, await tokenOf("ana"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ userId: USERS.ana.id, role: "customer" });
  });

  // Upiti idu u ime korisnika: agent vidi bar onoliko zahteva koliko Ana (RLS).
  it("upiti poštuju RLS za prijavljenog korisnika", async () => {
    const ana = await (await call(whoAmI, await tokenOf("ana"))).json();
    const agent = await (await call(whoAmI, await tokenOf("agent"))).json();
    expect(agent.role).toBe("agent");
    expect(agent.visibleTickets).toBeGreaterThanOrEqual(ana.visibleTickets);
  });

  // Uloga koja nije dozvoljena: 403.
  it("agent ne može na rutu samo za admina", async () => {
    const response = await call(adminOnly, await tokenOf("agent"));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });

  it("admin može na rutu samo za admina", async () => {
    expect((await call(adminOnly, await tokenOf("admin"))).status).toBe(200);
  });

  // Bez tokena ili sa lažnim tokenom: 401.
  it("neispravan token vraća 401", async () => {
    const response = await call(whoAmI, "ovo-nije-jwt");
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });
});
