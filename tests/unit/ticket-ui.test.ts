/**
 * Unit testovi: pomoćne funkcije stranica za zahteve (Faza 5b):
 *   - filteri u adresi (src/components/tickets/list-params.ts)
 *   - nazivi dugmadi za prelaze statusa (src/components/tickets/ticket-labels.ts)
 *   - da svaki status, prioritet, prelaz, sortiranje i vrsta istorije ima
 *     prevod na srpskom i engleskom (messages/*.json)
 */
import { describe, expect, it } from "vitest";

import {
  hasActiveFilters,
  parseTicketListParams,
  ticketListHref,
} from "@/components/tickets/list-params";
import { SORT_LABEL_KEYS, transitionLabelKey } from "@/components/tickets/ticket-labels";
import { TICKET_SORTS } from "@/lib/validation/tickets";
import { STATUS_TRANSITIONS } from "@/services/policies/status-transitions";
import { HISTORY_ACTIONS, TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/domain";
import en from "../../messages/en.json";
import sr from "../../messages/sr.json";

const CATEGORY_ID = "10000000-0000-4000-8000-000000000001";

describe("parseTicketListParams", () => {
  it("bez parametara: prva strana, 20 stavki, najnoviji prvo", () => {
    expect(parseTicketListParams({})).toEqual({ page: 1, pageSize: 20, sort: "-createdAt" });
  });

  it("čita filtere i brojeve iz adrese", () => {
    expect(
      parseTicketListParams({ status: "open", categoryId: CATEGORY_ID, q: "vpn", page: "2" }),
    ).toEqual({
      status: "open",
      categoryId: CATEGORY_ID,
      q: "vpn",
      page: 2,
      pageSize: 20,
      sort: "-createdAt",
    });
  });

  it("prazne vrednosti (?status=) se tretiraju kao neposlate", () => {
    expect(parseTicketListParams({ status: "", q: "  " })).toEqual(parseTicketListParams({}));
  });

  it("status=unresolved (svi nerešeni) je dozvoljen filter", () => {
    expect(parseTicketListParams({ status: "unresolved" }).status).toBe("unresolved");
    expect(ticketListHref(parseTicketListParams({ status: "unresolved" }))).toBe(
      "/tickets?status=unresolved",
    );
  });

  it("neispravan parametar se zanemaruje, ostali ostaju", () => {
    expect(parseTicketListParams({ status: "xyz", priority: "high", page: "-1" })).toEqual({
      priority: "high",
      page: 1,
      pageSize: 20,
      sort: "-createdAt",
    });
  });

  it("ponovljen parametar: važi prva vrednost; nepoznati parametri se zanemaruju", () => {
    expect(parseTicketListParams({ status: ["resolved", "open"], foo: "bar" }).status).toBe(
      "resolved",
    );
  });
});

describe("ticketListHref", () => {
  it("podrazumevane vrednosti se ne pišu u adresu", () => {
    expect(ticketListHref(parseTicketListParams({}))).toBe("/tickets");
  });

  it("zadržava filtere i menja samo stranu", () => {
    const query = parseTicketListParams({ status: "open", q: "štampač" });
    expect(ticketListHref(query, { page: 3 })).toBe(
      "/tickets?status=open&q=%C5%A1tampa%C4%8D&page=3",
    );
  });

  it("uklanja filter postavljen na undefined", () => {
    const query = parseTicketListParams({ status: "open", sort: "priority" });
    expect(ticketListHref(query, { status: undefined })).toBe("/tickets?sort=priority");
  });

  it("hasActiveFilters: sortiranje i strana nisu filteri", () => {
    expect(hasActiveFilters(parseTicketListParams({ sort: "priority", page: "2" }))).toBe(false);
    expect(hasActiveFilters(parseTicketListParams({ assigneeId: "me" }))).toBe(true);
  });
});

describe("transitionLabelKey", () => {
  it("korisnik: otkazuje otvoren, potvrđuje rešen i ponovo otvara rešen zahtev", () => {
    expect(transitionLabelKey("open", "closed", true)).toBe("cancel");
    expect(transitionLabelKey("resolved", "closed", true)).toBe("confirm");
    expect(transitionLabelKey("resolved", "in_progress", true)).toBe("reopen");
  });

  it("tim podrške: isti prelazi imaju nazive za rad na zahtevu", () => {
    expect(transitionLabelKey("open", "closed", false)).toBe("close");
    expect(transitionLabelKey("resolved", "closed", false)).toBe("close");
    expect(transitionLabelKey("open", "in_progress", false)).toBe("startWork");
    expect(transitionLabelKey("in_progress", "waiting_on_customer", false)).toBe("waitOnCustomer");
    expect(transitionLabelKey("waiting_on_customer", "in_progress", false)).toBe("resume");
    expect(transitionLabelKey("waiting_on_customer", "resolved", false)).toBe("resolve");
    expect(transitionLabelKey("closed", "open", false)).toBe("reopen");
  });

  it.each(STATUS_TRANSITIONS.map((row) => [row.from, row.to] as const))(
    "prelaz %s -> %s ima prevod dugmeta u oba jezika",
    (from, to) => {
      for (const isCustomer of [true, false]) {
        const key = transitionLabelKey(from, to, isCustomer);
        expect(sr.tickets.transitions).toHaveProperty(key);
        expect(en.tickets.transitions).toHaveProperty(key);
      }
    },
  );
});

describe("prevodi za zahteve", () => {
  it.each(TICKET_STATUSES)("status %s ima naziv u oba jezika", (status) => {
    expect(sr.ticketStatus).toHaveProperty(status);
    expect(en.ticketStatus).toHaveProperty(status);
  });

  it.each(TICKET_PRIORITIES)("prioritet %s ima naziv u oba jezika", (priority) => {
    expect(sr.ticketPriority).toHaveProperty(priority);
    expect(en.ticketPriority).toHaveProperty(priority);
  });

  it.each(TICKET_SORTS)("sortiranje %s ima naziv u oba jezika", (sort) => {
    expect(sr.tickets.sort).toHaveProperty(SORT_LABEL_KEYS[sort]);
    expect(en.tickets.sort).toHaveProperty(SORT_LABEL_KEYS[sort]);
  });

  it.each(HISTORY_ACTIONS)("vrsta istorije %s ima opis u oba jezika", (action) => {
    expect(sr.tickets.history).toHaveProperty(action);
    expect(en.tickets.history).toHaveProperty(action);
  });
});
