/**
 * Unit testovi: Zod šeme za zahteve, komentare i ocene
 * (src/lib/validation/tickets.ts, comments.ts, ratings.ts) i obrada teksta
 * za pretragu (src/services/tickets/ticket-search.ts).
 *
 * Proverava granice (iste kao CHECK ograničenja u bazi), podrazumevane
 * vrednosti, odbijanje nepoznatih polja i da svaka poruka greške ima prevod
 * u oba jezika (messages/*.json -> validation.<ključ>).
 */
import { describe, expect, it } from "vitest";

import { addCommentSchema, COMMENT_VALIDATION_KEYS } from "@/lib/validation/comments";
import { RATING_VALIDATION_KEYS, rateTicketSchema } from "@/lib/validation/ratings";
import {
  assignTicketSchema,
  createTicketSchema,
  TICKET_VALIDATION_KEYS,
  ticketListQuerySchema,
  updateTicketSchema,
} from "@/lib/validation/tickets";
import { parseTicketSearch } from "@/services/tickets/ticket-search";
import en from "../../messages/en.json";
import sr from "../../messages/sr.json";

const CATEGORY_ID = "10000000-0000-4000-8000-000000000001";

/** Prva poruka greške za polje (ključ prevoda). */
function firstIssue(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("createTicketSchema", () => {
  const valid = {
    title: "Ne radi štampač",
    description: "Štampač javlja grešku E-04.",
    categoryId: CATEGORY_ID,
  };

  it("prihvata ispravan zahtev i dodaje prioritet medium", () => {
    expect(createTicketSchema.parse(valid)).toEqual({ ...valid, priority: "medium" });
  });

  it("uklanja razmake na krajevima i proverava dužine", () => {
    expect(createTicketSchema.parse({ ...valid, title: "  Ne radi štampač  " }).title).toBe(
      "Ne radi štampač",
    );
    expect(firstIssue(createTicketSchema.safeParse({ ...valid, title: "Abc" }))).toBe(
      "titleLength",
    );
    expect(firstIssue(createTicketSchema.safeParse({ ...valid, description: "kratko" }))).toBe(
      "descriptionLength",
    );
    expect(createTicketSchema.safeParse({ ...valid, title: "x".repeat(151) }).success).toBe(false);
  });

  it("odbija nepoznata polja (npr. status ili createdBy)", () => {
    expect(createTicketSchema.safeParse({ ...valid, status: "closed" }).success).toBe(false);
  });
});

describe("updateTicketSchema i assignTicketSchema", () => {
  it("traži bar jedno polje", () => {
    expect(updateTicketSchema.safeParse({}).success).toBe(false);
    expect(updateTicketSchema.parse({ priority: "urgent" })).toEqual({ priority: "urgent" });
  });

  it("dodela prima uuid ili null (oslobađanje)", () => {
    expect(assignTicketSchema.parse({ assigneeId: null })).toEqual({ assigneeId: null });
    expect(assignTicketSchema.safeParse({ assigneeId: "agent" }).success).toBe(false);
    expect(assignTicketSchema.safeParse({}).success).toBe(false);
  });
});

describe("ticketListQuerySchema", () => {
  it("podrazumevane vrednosti: prva stranica, 20 stavki, najnoviji prvo", () => {
    expect(ticketListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, sort: "-createdAt" });
  });

  it("brojevi iz adrese postaju brojevi; pageSize najviše 100", () => {
    expect(ticketListQuerySchema.parse({ page: "3", pageSize: "50" })).toMatchObject({
      page: 3,
      pageSize: 50,
    });
    expect(ticketListQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });

  it("assigneeId: me, unassigned ili uuid", () => {
    expect(ticketListQuerySchema.parse({ assigneeId: "me" }).assigneeId).toBe("me");
    expect(ticketListQuerySchema.parse({ assigneeId: CATEGORY_ID }).assigneeId).toBe(CATEGORY_ID);
    expect(ticketListQuerySchema.safeParse({ assigneeId: "neko" }).success).toBe(false);
  });

  it("odbija nepoznat status i sortiranje", () => {
    expect(ticketListQuerySchema.safeParse({ status: "done" }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ sort: "title" }).success).toBe(false);
  });
});

describe("addCommentSchema i rateTicketSchema", () => {
  it("komentar: 1–5000 znakova, isInternal podrazumevano false", () => {
    expect(addCommentSchema.parse({ body: " Zdravo " })).toEqual({
      body: "Zdravo",
      isInternal: false,
    });
    expect(firstIssue(addCommentSchema.safeParse({ body: "   " }))).toBe("commentLength");
    expect(addCommentSchema.safeParse({ body: "x".repeat(5001) }).success).toBe(false);
  });

  it("ocena: ceo broj 1–5, komentar do 1000 znakova", () => {
    expect(rateTicketSchema.parse({ score: 5 })).toEqual({ score: 5 });
    expect(firstIssue(rateTicketSchema.safeParse({ score: 0 }))).toBe("scoreRange");
    expect(rateTicketSchema.safeParse({ score: 4.5 }).success).toBe(false);
    expect(firstIssue(rateTicketSchema.safeParse({ score: 3, comment: "x".repeat(1001) }))).toBe(
      "ratingCommentLength",
    );
  });
});

describe("prevodi poruka grešaka", () => {
  const keys = [
    ...Object.values(TICKET_VALIDATION_KEYS),
    ...Object.values(COMMENT_VALIDATION_KEYS),
    ...Object.values(RATING_VALIDATION_KEYS),
  ];

  it.each(keys)("validation.%s postoji na srpskom i engleskom", (key) => {
    expect(sr.validation).toHaveProperty(key);
    expect(en.validation).toHaveProperty(key);
  });
});

describe("parseTicketSearch", () => {
  it("broj zahteva: #1042 ili 1042", () => {
    expect(parseTicketSearch("#1042")).toEqual({ kind: "number", number: 1042 });
    expect(parseTicketSearch(" 1042 ")).toEqual({ kind: "number", number: 1042 });
  });

  it("reči postaju upit „počinje sa“, sve reči moraju postojati", () => {
    expect(parseTicketSearch("Štampač kanc")).toEqual({
      kind: "text",
      tsquery: "štampač:* & kanc:*",
    });
  });

  it("posebni znakovi to_tsquery jezika se izbacuju", () => {
    expect(parseTicketSearch("vpn & (!lozinka):*")).toEqual({
      kind: "text",
      tsquery: "vpn:* & lozinka:*",
    });
  });

  it("prazna pretraga ili samo znakovi: bez filtera", () => {
    expect(parseTicketSearch(undefined)).toEqual({ kind: "none" });
    expect(parseTicketSearch("  ")).toEqual({ kind: "none" });
    expect(parseTicketSearch("&|!")).toEqual({ kind: "none" });
  });
});
