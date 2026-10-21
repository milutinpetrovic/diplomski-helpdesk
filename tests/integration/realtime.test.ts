/**
 * Integracioni testovi: real-time preko pravog Supabase Realtime servera
 * (WebSocket), Faza 7. Kriterijumi iz docs/07:
 *   - akcija jednog korisnika stiže drugom bez reload-a (kroz API rutu ->
 *     RealtimePublisher -> Realtime -> RealtimeProvider)
 *   - korisnik ne može da se pretplati na kanal tuđeg zahteva
 *   - poruka ne sadrži tekst komentara ni naslov, samo ID-jeve
 *   - novo obaveštenje stiže vlasniku (postgres_changes nad notifications, RLS)
 *
 * Pokreću se u CI-u (posao `db` pokreće ceo lokalni Supabase, sa Realtime-om).
 * Okruženje bez Realtime servera ih isključuje sa REALTIME_TESTS=off.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { POST as addComment } from "@/app/api/tickets/[id]/comments/route";
import { REALTIME_EVENTS, ticketChannel, userChannel } from "@/lib/realtime/events";
import { SupabaseRealtimeProvider } from "@/lib/realtime/supabase-provider";
import type { RealtimePayload } from "@/lib/realtime/types";
import { as, createTicketInStatus, USERS, type DbClient, type TicketRow } from "./helpers";

/** Koliko najviše čekamo na Realtime (ms); stvarno kašnjenje se ispisuje u log. */
const TIMEOUT_MS = 10_000;

/** Tekst komentara; ne sme da se pojavi u real-time poruci. */
const COMMENT_TEXT = "Tekst koji ne sme u real-time poruku";

/** Prijavljeni klijenti (sa otvorenom sesijom za Realtime). */
let ana: DbClient;
let marko: DbClient;
let agent: DbClient;

/** Zahtev (vlasnik Ana, dodeljen agentu). */
let ticket: TicketRow;

beforeAll(async () => {
  [ana, marko, agent] = await Promise.all([as("ana"), as("marko"), as("agent")]);
  ticket = await createTicketInStatus("in_progress");
});

/** Pristupni token prijavljenog klijenta. */
async function tokenOf(client: DbClient): Promise<string> {
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error("Nema sesije");
  return data.session.access_token;
}

/** Čeka da se kanal sa datim nazivom poveže (stanje „joined“). */
async function waitForJoined(client: DbClient, topic: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const channel = client.getChannels().find((c) => c.topic === `realtime:${topic}`);
    if (channel?.state === "joined") return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Kanal ${topic} se nije povezao za ${TIMEOUT_MS} ms`);
}

/** Obećanje koje se ispunjava prvom porukom (ili pada posle TIMEOUT_MS). */
function nextMessage() {
  let resolve!: (payload: RealtimePayload) => void;
  const promise = new Promise<RealtimePayload>((done, fail) => {
    resolve = done;
    setTimeout(() => fail(new Error("Poruka nije stigla")), TIMEOUT_MS);
  });
  return { promise, handler: (payload: RealtimePayload) => resolve(payload) };
}

/** Komentar u ime korisnika kroz API rutu (kao iz aplikacije ili Swagger-a). */
async function commentAs(client: DbClient, body: string): Promise<void> {
  const response = await addComment(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await tokenOf(client)}`,
      },
      body: JSON.stringify({ body }),
    }),
    { params: Promise.resolve({ id: ticket.id }) },
  );
  expect(response.status).toBe(201);
}

/**
 * Pokušaj pretplate na privatni kanal direktno preko Supabase klijenta.
 * Vraća: SUBSCRIBED ako je dozvoljeno, inače CHANNEL_ERROR (ili TIMED_OUT).
 */
async function trySubscribe(client: DbClient, topic: string): Promise<string> {
  await client.realtime.setAuth(await tokenOf(client));
  const channel = client.channel(`${topic}`, { config: { private: true } });
  try {
    return await new Promise<string>((resolve) => {
      channel.subscribe((status) => {
        if (status !== "CLOSED") resolve(status);
      });
    });
  } finally {
    await client.removeChannel(channel);
  }
}

describe.skipIf(process.env.REALTIME_TESTS === "off")("Supabase Realtime", () => {
  it("komentar korisnika stiže agentu na kanal zahteva, samo sa ID-jevima", async () => {
    // Korak 1: agent sluša kanal zahteva preko RealtimeProvider-a (kao u aplikaciji).
    const provider = new SupabaseRealtimeProvider(agent);
    const message = nextMessage();
    const stop = provider.subscribe(
      ticketChannel(ticket.id),
      REALTIME_EVENTS.TICKET_COMMENT_ADDED,
      message.handler,
    );
    try {
      await waitForJoined(agent, ticketChannel(ticket.id));

      // Korak 2: Ana dodaje komentar kroz API rutu.
      const started = Date.now();
      await commentAs(ana, COMMENT_TEXT);
      const payload = await message.promise;
      console.info(`[realtime] komentar stigao agentu za ${Date.now() - started} ms`);

      // Korak 3: poruka nosi samo vrstu događaja i ID-jeve.
      expect(payload).toEqual({
        event: REALTIME_EVENTS.TICKET_COMMENT_ADDED,
        ticketId: ticket.id,
        actorId: USERS.ana.id,
      });
      expect(JSON.stringify(payload)).not.toContain(COMMENT_TEXT);
      expect(JSON.stringify(payload)).not.toContain(ticket.title);
    } finally {
      stop();
    }
  });

  it("korisnik ne može da se pretplati na kanal tuđeg zahteva", async () => {
    // Vlasnik sme (kontrolni slučaj), drugi korisnik ne sme.
    expect(await trySubscribe(ana, ticketChannel(ticket.id))).toBe("SUBSCRIBED");
    expect(await trySubscribe(marko, ticketChannel(ticket.id))).toBe("CHANNEL_ERROR");
    // Ni na kanal tima ni na tuđi lični kanal.
    expect(await trySubscribe(marko, "staff")).toBe("CHANNEL_ERROR");
    expect(await trySubscribe(marko, userChannel(USERS.ana.id))).toBe("CHANNEL_ERROR");
  });

  it("novo obaveštenje stiže vlasniku zahteva (tabela notifications, RLS)", async () => {
    // Korak 1: Ana sluša svoja obaveštenja.
    const provider = new SupabaseRealtimeProvider(ana);
    const message = nextMessage();
    const stop = provider.subscribe(
      userChannel(USERS.ana.id),
      REALTIME_EVENTS.NOTIFICATION_CREATED,
      message.handler,
    );
    try {
      await waitForJoined(ana, `${userChannel(USERS.ana.id)}:notifications`);
      // Praćenje izmena u tabeli se uključuje malo posle povezivanja kanala.
      await new Promise((resolve) => setTimeout(resolve, 1_000));

      // Korak 2: agent komentariše Anin zahtev (baza pravi obaveštenje za Anu).
      const started = Date.now();
      await commentAs(agent, "Odgovor agenta.");
      const payload = await message.promise;
      console.info(`[realtime] obaveštenje stiglo Ani za ${Date.now() - started} ms`);

      // Korak 3: poruka nosi samo ID zahteva i aktera.
      expect(payload).toEqual({
        event: REALTIME_EVENTS.NOTIFICATION_CREATED,
        ticketId: ticket.id,
        actorId: USERS.agent.id,
      });
    } finally {
      stop();
    }
  });
});
