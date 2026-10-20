/**
 * Integracioni testovi: dozvole za privatne real-time kanale.
 *
 * Proverava funkciju can_access_realtime_topic, koju koriste politike nad
 * realtime.messages (migracija realtime_authorization):
 *   ticket:<id> - vlasnik zahteva i tim podrške
 *   staff       - samo agent i admin
 *   user:<id>   - samo taj korisnik
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { as, createTicket, expectDbOk, USERS, type SeedUser } from "./helpers";

/** Poziva can_access_realtime_topic u ime datog naloga. */
async function canAccess(user: SeedUser, topic: string): Promise<boolean> {
  const client = await as(user);
  return expectDbOk(client.rpc("can_access_realtime_topic", { p_topic: topic }));
}

describe("can_access_realtime_topic", () => {
  // Kanal zahteva: vlasnik i tim da, drugi korisnik ne.
  it("ticket:<id>", async () => {
    const ticket = await createTicket("ana");
    const topic = `ticket:${ticket.id}`;
    expect(await canAccess("ana", topic)).toBe(true);
    expect(await canAccess("agent", topic)).toBe(true);
    expect(await canAccess("admin", topic)).toBe(true);
    expect(await canAccess("marko", topic)).toBe(false);
    // Nepostojeći zahtev i neispravan naziv kanala.
    expect(await canAccess("agent", `ticket:${randomUUID()}`)).toBe(false);
    expect(await canAccess("agent", "ticket:abc")).toBe(false);
  });

  // Kanal tima.
  it("staff", async () => {
    expect(await canAccess("agent", "staff")).toBe(true);
    expect(await canAccess("admin", "staff")).toBe(true);
    expect(await canAccess("ana", "staff")).toBe(false);
  });

  // Lični kanal.
  it("user:<id>", async () => {
    expect(await canAccess("ana", `user:${USERS.ana.id}`)).toBe(true);
    expect(await canAccess("ana", `user:${USERS.marko.id}`)).toBe(false);
    expect(await canAccess("admin", `user:${USERS.ana.id}`)).toBe(false);
  });
});
