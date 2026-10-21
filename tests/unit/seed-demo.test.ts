/**
 * Unit testovi: generator demo podataka (scripts/seed-demo.mts), bez baze.
 *
 * Proverava kriterijume iz docs/02 (sekcija 9) i docs/07 (Faza 8):
 *   - isti početni broj daje iste podatke (deterministička skripta)
 *   - oko 150 zahteva kroz 6 meseci, većina rešena ili zatvorena, deo otvoren
 *   - 1–8 komentara po zahtevu (osim nepreuzetih i otkazanih), deo internih
 *   - vremena imaju smisla: prvi odgovor posle kreiranja, rešenje posle
 *     prvog odgovora, sve pre „sada“
 *   - ocene za oko 60% rešenih, pretežno 4 i 5
 *   - 2 nova agenta i 18 novih korisnika sa jedinstvenim emailovima
 */
import { describe, expect, it } from "vitest";

import { DEMO_USERS, generateDemoData } from "../../scripts/seed-demo.mjs";

/** Fiksan trenutak „sada“ za test. */
const NOW = Date.parse("2026-10-21T10:00:00Z");
const data = generateDemoData(NOW);

describe("demo podaci", () => {
  it("isti početni broj daje iste podatke, drugi broj druge", () => {
    expect(generateDemoData(NOW)).toEqual(data);
    expect(generateDemoData(NOW, 1).tickets).not.toEqual(data.tickets);
  });

  it("nalozi: 2 agenta i 18 korisnika, jedinstveni emailovi bez dijakritika", () => {
    expect(DEMO_USERS.filter((user) => user.role === "agent")).toHaveLength(2);
    expect(DEMO_USERS.filter((user) => user.role === "customer")).toHaveLength(18);
    const emails = DEMO_USERS.map((user) => user.email);
    expect(new Set(emails).size).toBe(emails.length);
    expect(emails.every((email) => /^[a-z.]+@demo\.helpdesk\.test$/.test(email))).toBe(true);
    expect(emails).toContain("andjela.tomic@demo.helpdesk.test");
  });

  it("oko 150 zahteva kroz 6 meseci; većina rešena ili zatvorena, deo otvoren", () => {
    expect(data.tickets.length).toBeGreaterThanOrEqual(130);
    expect(data.tickets.length).toBeLessThanOrEqual(200);
    const oldest = Math.min(...data.tickets.map((ticket) => Date.parse(ticket.created_at!)));
    expect(NOW - oldest).toBeGreaterThan(170 * 86_400_000);
    const done = data.tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status!));
    expect(done.length / data.tickets.length).toBeGreaterThan(0.75);
    expect(data.tickets.length - done.length).toBeGreaterThanOrEqual(5);
  });

  it("vremena su u ispravnom redosledu i pre „sada“", () => {
    for (const ticket of data.tickets) {
      const created = Date.parse(ticket.created_at!);
      expect(created).toBeLessThan(NOW);
      if (ticket.first_response_at)
        expect(Date.parse(ticket.first_response_at)).toBeGreaterThan(created);
      if (ticket.resolved_at) {
        expect(Date.parse(ticket.resolved_at)).toBeGreaterThan(
          Date.parse(ticket.first_response_at!),
        );
        expect(Date.parse(ticket.resolved_at)).toBeLessThan(NOW);
      }
      if (ticket.closed_at) expect(Date.parse(ticket.closed_at)).toBeLessThan(NOW);
      // Rešen ili zatvoren posle rešenja ima resolved_at; nedodeljen nema prvi odgovor.
      if (ticket.status === "resolved") expect(ticket.resolved_at).toBeTruthy();
      if (!ticket.assigned_to) expect(ticket.first_response_at).toBeNull();
    }
    // Zahtevi su poređani po vremenu (brojevi # rastu kroz vreme).
    const times = data.tickets.map((ticket) => ticket.created_at!);
    expect([...times].sort()).toEqual(times);
  });

  it("komentari: najviše 8 po zahtevu, deo internih, nijedan pre kreiranja", () => {
    const perTicket = new Map<string, number>();
    const created = new Map(data.tickets.map((ticket) => [ticket.id!, ticket.created_at!]));
    for (const comment of data.comments) {
      perTicket.set(comment.ticket_id, (perTicket.get(comment.ticket_id) ?? 0) + 1);
      expect(comment.created_at! > created.get(comment.ticket_id)!).toBe(true);
    }
    expect(Math.max(...perTicket.values())).toBeLessThanOrEqual(8);
    const internal = data.comments.filter((comment) => comment.is_internal).length;
    expect(internal / data.comments.length).toBeGreaterThan(0.05);
    // Svaki preuzet zahtev ima bar prvi odgovor.
    for (const ticket of data.tickets.filter((item) => item.first_response_at)) {
      expect(perTicket.get(ticket.id!)).toBeGreaterThanOrEqual(1);
    }
  });

  it("ocene: oko 60% rešenih, pretežno 4 i 5, samo za rešene zahteve", () => {
    const resolved = data.tickets.filter((ticket) => ticket.resolved_at);
    const ratio = data.ratings.length / resolved.length;
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.75);
    const high = data.ratings.filter((rating) => rating.score >= 4).length;
    expect(high / data.ratings.length).toBeGreaterThan(0.6);
    const resolvedIds = new Set(resolved.map((ticket) => ticket.id));
    expect(data.ratings.every((rating) => resolvedIds.has(rating.ticket_id))).toBe(true);
  });
});
