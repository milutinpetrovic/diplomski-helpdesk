/**
 * Integracioni testovi: API obaveštenja (Faza 7, UC-08) nad pravim lokalnim
 * Supabase-om:
 *   - GET /api/notifications
 *   - POST /api/notifications/{id}/read
 *   - POST /api/notifications/read-all
 *
 * Proverava: akcija agenta pravi obaveštenje korisniku sa brojem zahteva i
 * imenom agenta (bez teksta komentara); brojač nepročitanih je tačan; filter
 * „samo nepročitana“; korisnik ne vidi niti označava tuđa obaveštenja.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { POST as readAll } from "@/app/api/notifications/read-all/route";
import { GET as listNotifications } from "@/app/api/notifications/route";
import { POST as readOne } from "@/app/api/notifications/[id]/read/route";
import { POST as addComment } from "@/app/api/tickets/[id]/comments/route";
import type { RouteHandler } from "@/lib/api/with-api";
import { notificationListSchema } from "@/lib/validation/notifications";
import { as, createTicketInStatus, type SeedUser, type TicketRow } from "./helpers";

/** Pristupni tokeni demo naloga. */
const tokens: Partial<Record<SeedUser, string>> = {};

/** Zahtev (vlasnik Ana, dodeljen agentu) na kome se prave obaveštenja. */
let ticket: TicketRow;

/** Tekst komentara; ne sme da se pojavi u obaveštenju. */
const COMMENT_TEXT = "Tajni tekst komentara koji ne ide u obaveštenje";

beforeAll(async () => {
  for (const user of ["ana", "marko", "agent"] as const) {
    const client = await as(user);
    const { data } = await client.auth.getSession();
    if (!data.session) throw new Error(`Nema sesije za ${user}`);
    tokens[user] = data.session.access_token;
  }
  ticket = await createTicketInStatus("in_progress");
});

/** Poziva rutu u ime demo naloga; vraća status i JSON telo. */
async function call(
  route: RouteHandler,
  user: SeedUser,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string>;
    params?: Record<string, string>;
  } = {},
) {
  const url = new URL("http://localhost/api/test");
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  const response = await route(
    new Request(url, {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens[user]}` },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    { params: Promise.resolve(options.params ?? {}) },
  );
  const text = await response.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- telo odgovora se proverava u testu
  const json: any = text ? JSON.parse(text) : undefined;
  return { status: response.status, json };
}

describe("API obaveštenja", () => {
  it("komentar agenta pravi obaveštenje vlasniku, sa brojem zahteva i imenom, bez teksta", async () => {
    // Korak 1: Ana kreće od nule nepročitanih.
    expect((await call(readAll, "ana", { method: "POST" })).status).toBe(204);
    expect((await call(listNotifications, "ana")).json.unreadCount).toBe(0);

    // Korak 2: agent komentariše Anin zahtev.
    const comment = await call(addComment, "agent", {
      method: "POST",
      params: { id: ticket.id },
      body: { body: COMMENT_TEXT },
    });
    expect(comment.status).toBe(201);

    // Korak 3: Ana ima jedno nepročitano obaveštenje o komentaru.
    const { status, json } = await call(listNotifications, "ana");
    expect(status).toBe(200);
    expect(notificationListSchema.safeParse(json).success).toBe(true);
    expect(json.unreadCount).toBe(1);
    expect(json.items[0]).toMatchObject({
      type: "comment_added",
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      ticketTitle: ticket.title,
      actorName: "Jelena Agentić",
      isRead: false,
    });
    expect(JSON.stringify(json)).not.toContain(COMMENT_TEXT);
  });

  it("filter samo nepročitana i označavanje jednog kao pročitanog", async () => {
    const unread = await call(listNotifications, "ana", { query: { unreadOnly: "true" } });
    expect(unread.json.items.length).toBe(unread.json.unreadCount);
    expect(unread.json.items.every((item: { isRead: boolean }) => !item.isRead)).toBe(true);

    const first = unread.json.items[0];
    expect((await call(readOne, "ana", { method: "POST", params: { id: first.id } })).status).toBe(
      204,
    );
    // Ponovno označavanje istog nije greška.
    expect((await call(readOne, "ana", { method: "POST", params: { id: first.id } })).status).toBe(
      204,
    );
    const after = await call(listNotifications, "ana");
    expect(after.json.unreadCount).toBe(unread.json.unreadCount - 1);
  });

  it("korisnik ne vidi i ne označava tuđa obaveštenja (404)", async () => {
    // Novo nepročitano obaveštenje za Anu.
    await call(addComment, "agent", {
      method: "POST",
      params: { id: ticket.id },
      body: { body: "Još jedan komentar." },
    });
    const anas = await call(listNotifications, "ana");
    const anaNotification = anas.json.items[0];

    // Marko ne vidi Anina obaveštenja.
    const markos = await call(listNotifications, "marko", { query: { pageSize: "100" } });
    const markoIds = markos.json.items.map((item: { id: string }) => item.id);
    expect(markoIds).not.toContain(anaNotification.id);

    // Marko ne može da označi Anino obaveštenje; ono ostaje nepročitano.
    const denied = await call(readOne, "marko", {
      method: "POST",
      params: { id: anaNotification.id },
    });
    expect(denied.status).toBe(404);
    expect(denied.json.error.code).toBe("NOT_FOUND");
    const anaAfter = await call(listNotifications, "ana");
    expect(anaAfter.json.unreadCount).toBe(anas.json.unreadCount);
  });

  it("označi sve kao pročitano dira samo sopstvena obaveštenja", async () => {
    const agentBefore = await call(listNotifications, "agent");
    expect((await call(readAll, "ana", { method: "POST" })).status).toBe(204);
    expect((await call(listNotifications, "ana")).json.unreadCount).toBe(0);
    expect((await call(listNotifications, "agent")).json.unreadCount).toBe(
      agentBefore.json.unreadCount,
    );
  });

  it("neispravan ID i parametri daju 400", async () => {
    expect(
      (await call(readOne, "ana", { method: "POST", params: { id: "nije-uuid" } })).status,
    ).toBe(400);
    expect((await call(listNotifications, "ana", { query: { pageSize: "500" } })).status).toBe(400);
  });

  it("agent dobija obaveštenje o novom zahtevu korisnika", async () => {
    const before = await call(listNotifications, "agent");
    const created = await createTicketInStatus("open");
    const after = await call(listNotifications, "agent");
    expect(after.json.unreadCount).toBe(before.json.unreadCount + 1);
    expect(after.json.items[0]).toMatchObject({
      type: "ticket_created",
      ticketId: created.id,
      actorName: expect.any(String),
    });
  });
});
