/**
 * Unit testovi: obaveštenja i real-time sloj u pregledaču (Faza 7).
 *
 * Proverava:
 *   - tekst obaveštenja iz prevoda za svaku vrstu, na srpskom i engleskom
 *   - da sr i en imaju iste ključeve za obaveštenja
 *   - parametre stranice /notifications i Zod šemu liste
 *   - na kojim stranicama se radi osvežavanje bez reload-a i grupisanje osvežavanja
 *   - SupabaseRealtimeProvider: jedan kanal po nazivu, više slušalaca, zatvaranje
 *     posle poslednjeg slušaoca
 *   - SupabaseRealtimePublisher: poruka nosi SAMO ID-jeve (nikad tekst ni naslov)
 */
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  notificationListHref,
  parseNotificationParams,
} from "@/components/notifications/notification-params";
import {
  notificationHref,
  notificationText,
  type NotificationTranslator,
} from "@/components/notifications/notification-text";
import { REFRESH_DELAY_MS, scheduleRefresh } from "@/hooks/use-debounced-refresh";
import { isLiveRefreshPath } from "@/hooks/use-staff-realtime";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import { SupabaseRealtimeProvider } from "@/lib/realtime/supabase-provider";
import { SupabaseRealtimePublisher } from "@/lib/realtime/supabase-publisher";
import type { RealtimePayload } from "@/lib/realtime/types";
import type { DbClient } from "@/lib/supabase/types";
import { notificationListQuerySchema } from "@/lib/validation/notifications";
import { NOTIFICATION_TYPES } from "@/types/domain";
import en from "../../messages/en.json";
import sr from "../../messages/sr.json";

/** Funkcija prevoda za grupu notifications na datom jeziku. */
function translator(locale: "sr" | "en"): NotificationTranslator {
  const messages = locale === "sr" ? sr : en;
  const t = createTranslator({ locale, messages, namespace: "notifications" });
  return t as unknown as NotificationTranslator;
}

describe("tekst obaveštenja", () => {
  it.each(NOTIFICATION_TYPES)("%s ima tekst sa imenom i brojem na oba jezika", (type) => {
    for (const locale of ["sr", "en"] as const) {
      const text = notificationText(translator(locale), {
        type,
        actorName: "Jelena Agentić",
        ticketNumber: 1003,
      });
      expect(text).toContain("Jelena Agentić");
      expect(text).toContain("#1003");
    }
  });

  it("primeri na srpskom i engleskom", () => {
    const item = { type: "status_changed" as const, actorName: "Ana", ticketNumber: 1001 };
    expect(notificationText(translator("sr"), item)).toBe("Zahtev #1001: promenjen status (Ana)");
    expect(notificationText(translator("en"), item)).toBe("Ana changed the status of ticket #1001");
  });

  it("nepoznat akter je „Neko“, a nevidljiv zahtev „#?“", () => {
    const text = notificationText(translator("sr"), {
      type: "comment_added",
      actorName: null,
      ticketNumber: null,
    });
    expect(text).toBe("Zahtev #?: novi komentar (Neko)");
  });

  it("broj nepročitanih na zvoncu ima ispravan oblik množine na srpskom", () => {
    const t = translator("sr");
    expect(t("bellLabelUnread", { count: 1 })).toBe("Obaveštenja (1 nepročitano)");
    expect(t("bellLabelUnread", { count: 2 })).toBe("Obaveštenja (2 nepročitana)");
    expect(t("bellLabelUnread", { count: 5 })).toBe("Obaveštenja (5 nepročitanih)");
    expect(translator("en")("bellLabelUnread", { count: 2 })).toBe("Notifications (2 unread)");
  });

  it("link vodi na zahtev, a bez zahteva ga nema", () => {
    expect(notificationHref({ ticketId: "abc" })).toBe("/tickets/abc");
    expect(notificationHref({ ticketId: null })).toBeNull();
  });

  it("sr i en imaju iste ključeve", () => {
    expect(Object.keys(sr.notifications).sort()).toEqual(Object.keys(en.notifications).sort());
    expect(Object.keys(sr.notifications.types).sort()).toEqual([...NOTIFICATION_TYPES].sort());
    expect(Object.keys(en.notifications.types).sort()).toEqual([...NOTIFICATION_TYPES].sort());
    expect(sr.nav.notifications).toBeTruthy();
    expect(en.nav.notifications).toBeTruthy();
  });
});

describe("parametri stranice /notifications", () => {
  it("podrazumevano: prva strana, sva obaveštenja", () => {
    expect(parseNotificationParams({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("filter i strana iz adrese; neispravna vrednost se zanemaruje", () => {
    expect(parseNotificationParams({ unreadOnly: "true", page: "2" })).toMatchObject({
      page: 2,
      unreadOnly: "true",
    });
    expect(parseNotificationParams({ page: "abc" })).toEqual({ page: 1, pageSize: 20 });
  });

  it("adresa stranice", () => {
    expect(notificationListHref(false)).toBe("/notifications");
    expect(notificationListHref(true)).toBe("/notifications?unreadOnly=true");
    expect(notificationListHref(true, 3)).toBe("/notifications?unreadOnly=true&page=3");
  });

  it("šema API-ja odbija preveliku stranu i nepoznat filter", () => {
    expect(notificationListQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(notificationListQuerySchema.safeParse({ unreadOnly: "yes" }).success).toBe(false);
  });
});

describe("osvežavanje bez reload-a", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("samo stranice koje prikazuju zahteve", () => {
    expect(isLiveRefreshPath("/dashboard")).toBe(true);
    expect(isLiveRefreshPath("/tickets")).toBe(true);
    expect(isLiveRefreshPath("/tickets/abc")).toBe(true);
    expect(isLiveRefreshPath("/profile")).toBe(false);
    expect(isLiveRefreshPath("/admin/users")).toBe(false);
  });

  it("više događaja u kratkom roku daje jedno osvežavanje", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    scheduleRefresh(refresh);
    scheduleRefresh(refresh);
    scheduleRefresh(refresh);
    vi.advanceTimersByTime(REFRESH_DELAY_MS);
    expect(refresh).toHaveBeenCalledTimes(1);

    // Posle osvežavanja novi događaj zakazuje novo.
    scheduleRefresh(refresh);
    vi.advanceTimersByTime(REFRESH_DELAY_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

/** Lažni Supabase klijent: beleži kanale i omogućava slanje poruka u test. */
function fakeClient() {
  const channels: {
    topic: string;
    broadcast?: (message: { payload: unknown }) => void;
    sent: unknown[];
  }[] = [];
  const removed: string[] = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: "token-1" } } }) },
    realtime: { setAuth: vi.fn(async () => {}) },
    channel(topic: string) {
      const record: (typeof channels)[number] = { topic, sent: [] };
      channels.push(record);
      const channel = {
        on(_type: string, _filter: unknown, callback: (message: { payload: unknown }) => void) {
          record.broadcast = callback;
          return channel;
        },
        subscribe: () => channel,
        httpSend: async (_event: string, message: unknown) => {
          record.sent.push(message);
          return { success: true };
        },
        topic,
      };
      return channel;
    },
    removeChannel: async (channel: { topic: string }) => {
      removed.push(channel.topic);
    },
  };
  return {
    client: client as unknown as DbClient,
    channels,
    removed,
    setAuth: client.realtime.setAuth,
  };
}

/** Čeka da se završe asinhroni koraci (priprema prijave pre otvaranja kanala). */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SupabaseRealtimeProvider", () => {
  it("jedan kanal za više slušalaca; poruka ide samo slušaocima tog događaja", async () => {
    const { client, channels, removed, setAuth } = fakeClient();
    const provider = new SupabaseRealtimeProvider(client);
    const onUpdate = vi.fn();
    const onComment = vi.fn();

    const stopUpdate = provider.subscribe("ticket:1", REALTIME_EVENTS.TICKET_UPDATED, onUpdate);
    const stopComment = provider.subscribe(
      "ticket:1",
      REALTIME_EVENTS.TICKET_COMMENT_ADDED,
      onComment,
    );
    await flush();

    // Jedan Supabase kanal, otvoren sa tokenom prijavljenog korisnika.
    expect(channels.map((channel) => channel.topic)).toEqual(["ticket:1"]);
    expect(setAuth).toHaveBeenCalledWith("token-1");

    // Poruka o komentaru ide samo slušaocu komentara.
    const payload: RealtimePayload = {
      event: REALTIME_EVENTS.TICKET_COMMENT_ADDED,
      ticketId: "1",
      actorId: "u2",
    };
    channels[0]!.broadcast!({ payload });
    expect(onComment).toHaveBeenCalledWith(payload);
    expect(onUpdate).not.toHaveBeenCalled();

    // Kanal se zatvara tek kad ode poslednji slušalac.
    stopUpdate();
    expect(removed).toEqual([]);
    stopComment();
    expect(removed).toEqual(["ticket:1"]);
  });

  it("odjava pre otvaranja kanala: kanal se i ne otvara", async () => {
    const { client, channels } = fakeClient();
    const provider = new SupabaseRealtimeProvider(client);
    const stop = provider.subscribe("staff", REALTIME_EVENTS.TICKET_UPDATED, vi.fn());
    stop();
    await flush();
    expect(channels).toEqual([]);
  });

  it("obaveštenja idu na poseban kanal user:<id>:notifications", async () => {
    const { client, channels } = fakeClient();
    const provider = new SupabaseRealtimeProvider(client);
    provider.subscribe("user:u1", REALTIME_EVENTS.NOTIFICATION_CREATED, vi.fn());
    await flush();
    expect(channels.map((channel) => channel.topic)).toEqual(["user:u1:notifications"]);
  });
});

describe("SupabaseRealtimePublisher", () => {
  it("poruka nosi samo ID-jeve i vrstu događaja, sa tokenom pošiljaoca", async () => {
    const { client, channels, setAuth } = fakeClient();
    await new SupabaseRealtimePublisher(client, "bearer-token").publish(
      "ticket:1",
      REALTIME_EVENTS.TICKET_COMMENT_ADDED,
      { ticketId: "1", actorId: "u1" },
    );
    expect(setAuth).toHaveBeenCalledWith("bearer-token");
    expect(channels[0]!.sent).toEqual([
      { event: REALTIME_EVENTS.TICKET_COMMENT_ADDED, ticketId: "1", actorId: "u1" },
    ]);
  });

  it("bez tokena iz zaglavlja koristi token iz sesije (kolačić)", async () => {
    const { client, setAuth } = fakeClient();
    await new SupabaseRealtimePublisher(client).publish("staff", REALTIME_EVENTS.TICKET_UPDATED, {
      ticketId: "1",
    });
    expect(setAuth).toHaveBeenCalledWith("token-1");
  });
});
