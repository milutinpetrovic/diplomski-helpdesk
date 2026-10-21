/**
 * Unit testovi: analitika (Faza 8) bez baze.
 *
 * Proverava:
 *   - pravila perioda: današnji dan po Beogradu, podrazumevanih 30 dana,
 *     dopuna nepotpunog perioda, provera „od <= do“ i najviše 366 dana,
 *     izbor dana ili nedelje za trend, prepoznavanje brzog izbora
 *   - Zod šeme ulaza (iste poruke kao na formi)
 *   - pretvaranje redova iz baze i dopunu raspodele nulama
 *   - prikaz trajanja i ocene na srpskom i engleskom, nazive grupa
 *   - sortiranje tabele agenata (prazne vrednosti na kraju)
 *   - da sr i en imaju iste ključeve za analitiku
 */
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import {
  dimensionLabel,
  formatDuration,
  formatRating,
  type AnalyticsTranslator,
} from "@/components/analytics/analytics-format";
import { sortAgents } from "@/components/analytics/AgentsTable";
import {
  addDays,
  defaultBucket,
  lastDays,
  matchingPreset,
  rangeError,
  rangeLength,
  resolveRange,
  todayInAppZone,
} from "@/lib/analytics/period";
import {
  byDimensionQuerySchema,
  dateRangeQuerySchema,
  trendQuerySchema,
  type AgentStats,
} from "@/lib/validation/analytics";
import type { Category } from "@/lib/validation/categories";
import { fillDimension, toAgentStats, toOverview } from "@/services/analytics/analytics-mappers";
import en from "../../messages/en.json";
import sr from "../../messages/sr.json";

/** Funkcija prevoda za grupu analytics na datom jeziku. */
function translator(locale: "sr" | "en"): AnalyticsTranslator {
  const messages = locale === "sr" ? sr : en;
  return createTranslator({
    locale,
    messages,
    namespace: "analytics",
  }) as unknown as AnalyticsTranslator;
}

describe("period analitike", () => {
  it("danas po beogradskom vremenu (ponoć po UTC je već sledeći dan u Beogradu)", () => {
    expect(todayInAppZone(new Date("2026-10-21T21:30:00Z"))).toBe("2026-10-21");
    expect(todayInAppZone(new Date("2026-10-21T22:30:00Z"))).toBe("2026-10-22"); // CEST, +2
    expect(todayInAppZone(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01"); // CET, +1
  });

  it("dani se dodaju preko granice meseca, godine i letnjeg računanja vremena", () => {
    expect(addDays("2026-10-21", -29)).toBe("2026-09-22");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(rangeLength({ from: "2026-10-21", to: "2026-10-21" })).toBe(1);
    expect(rangeLength({ from: "2024-01-01", to: "2024-12-31" })).toBe(366); // prestupna
  });

  it("podrazumevano poslednjih 30 dana; nepotpun period se dopunjuje", () => {
    expect(resolveRange({}, "2026-10-21")).toEqual({ from: "2026-09-22", to: "2026-10-21" });
    expect(resolveRange({ from: "2026-10-01" }, "2026-10-21")).toEqual({
      from: "2026-10-01",
      to: "2026-10-21",
    });
    expect(resolveRange({ to: "2026-06-30" }, "2026-10-21")).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
    expect(lastDays(7, "2026-10-21")).toEqual({ from: "2026-10-15", to: "2026-10-21" });
  });

  it("provera perioda: redosled i najviše 366 dana", () => {
    expect(rangeError({ from: "2026-10-01", to: "2026-10-01" })).toBeNull();
    expect(rangeError({ from: "2026-10-02", to: "2026-10-01" })).toBe("rangeOrder");
    expect(rangeError({ from: "2025-10-21", to: "2026-10-21" })).toBeNull(); // 366 dana
    expect(rangeError({ from: "2025-10-20", to: "2026-10-21" })).toBe("rangeTooLong");
  });

  it("trend: po danu do 62 dana, duže po nedelji", () => {
    expect(defaultBucket(lastDays(62, "2026-10-21"))).toBe("day");
    expect(defaultBucket(lastDays(63, "2026-10-21"))).toBe("week");
  });

  it("brzi izbor se prepoznaje samo kad se period završava danas", () => {
    expect(matchingPreset(lastDays(90, "2026-10-21"), "2026-10-21")).toBe(90);
    expect(matchingPreset({ from: "2026-10-01", to: "2026-10-21" }, "2026-10-21")).toBeNull();
    expect(matchingPreset(lastDays(30, "2026-10-20"), "2026-10-21")).toBeNull();
  });
});

describe("Zod šeme analitike", () => {
  it("prihvata ispravan i prazan period", () => {
    expect(dateRangeQuerySchema.safeParse({}).success).toBe(true);
    expect(dateRangeQuerySchema.safeParse({ from: "2026-09-22", to: "2026-10-21" }).success).toBe(
      true,
    );
  });

  it("odbija loš datum, obrnut i predug period; poruka je ključ prevoda", () => {
    expect(dateRangeQuerySchema.safeParse({ from: "21.10.2026" }).success).toBe(false);
    const reversed = dateRangeQuerySchema.safeParse({ from: "2026-10-21", to: "2026-10-01" });
    expect(reversed.error?.issues[0]?.message).toBe("rangeOrder");
    const tooLong = dateRangeQuerySchema.safeParse({ from: "2020-01-01", to: "2026-10-01" });
    expect(tooLong.error?.issues[0]?.message).toBe("rangeTooLong");
    expect(sr.validation.rangeOrder).toBeTruthy();
    expect(en.validation.rangeTooLong).toBeTruthy();
  });

  it("dimenzija je obavezna i poznata; interval je dan ili nedelja", () => {
    expect(byDimensionQuerySchema.safeParse({}).success).toBe(false);
    expect(byDimensionQuerySchema.safeParse({ dimension: "category" }).success).toBe(true);
    expect(trendQuerySchema.safeParse({ bucket: "week" }).success).toBe(true);
    expect(trendQuerySchema.safeParse({ bucket: "month" }).success).toBe(false);
  });
});

describe("pretvaranje podataka iz baze", () => {
  const range = { from: "2026-09-22", to: "2026-10-21" };

  it("KPI red: prazni proseci su null, raspodela ima 5 ocena", () => {
    const overview = toOverview(range, {
      created_count: 0,
      resolved_count: 0,
      closed_count: 0,
      open_count: 3,
      avg_first_response_minutes: null as unknown as number,
      avg_resolution_minutes: null as unknown as number,
      avg_rating: null as unknown as number,
      rating_count: 0,
      rating_distribution: [0, 0, 0, 0, 0],
    });
    expect(overview.avgFirstResponseMinutes).toBeNull();
    expect(overview.csat.average).toBeNull();
    expect(overview.csat.distribution.map((item) => item.score)).toEqual([1, 2, 3, 4, 5]);
    expect(overview).toMatchObject({ ...range, openCount: 3 });
  });

  it("raspodela po statusu i prioritetu: sve vrednosti redom, nule dopunjene", () => {
    expect(
      fillDimension("status", [{ key: "closed", total: 4 }]).map((item) => item.total),
    ).toEqual([0, 0, 0, 0, 4]);
    expect(fillDimension("priority", []).map((item) => item.key)).toEqual([
      "low",
      "medium",
      "high",
      "urgent",
    ]);
  });

  it("raspodela po kategoriji: nazivi; neaktivna bez zahteva se izostavlja", () => {
    const category = (id: string, isActive: boolean): Category => ({
      id,
      slug: id,
      nameSr: `Kategorija ${id}`,
      nameEn: `Category ${id}`,
      descriptionSr: null,
      descriptionEn: null,
      isActive,
      sortOrder: 1,
    });
    const items = fillDimension(
      "category",
      [{ key: "b", total: 2 }],
      [category("a", true), category("b", false), category("c", false)],
    );
    expect(items).toEqual([
      { key: "a", total: 0, nameSr: "Kategorija a", nameEn: "Category a" },
      { key: "b", total: 2, nameSr: "Kategorija b", nameEn: "Category b" },
    ]);
  });

  it("red agenta u camelCase obliku", () => {
    expect(
      toAgentStats({
        agent_id: "id-1",
        full_name: "Jelena Agentić",
        role: "agent",
        is_active: true,
        assigned_count: 3,
        resolved_count: 2,
        avg_resolution_minutes: 90.5,
        avg_rating: 4.5,
        rating_count: 2,
      }),
    ).toEqual({
      agentId: "id-1",
      fullName: "Jelena Agentić",
      role: "agent",
      isActive: true,
      assignedCount: 3,
      resolvedCount: 2,
      avgResolutionMinutes: 90.5,
      avgRating: 4.5,
      ratingCount: 2,
    });
  });
});

describe("prikaz brojeva", () => {
  it("trajanje na srpskom: minuti, sati i minuti, dani i sati", () => {
    const t = translator("sr");
    expect(formatDuration(t, 45.4)).toBe("45 min");
    expect(formatDuration(t, 135)).toBe("2 h 15 min");
    expect(formatDuration(t, 3 * 24 * 60 + 4 * 60 + 10)).toBe("3 d 4 h");
    expect(formatDuration(t, null)).toBe("—");
  });

  it("ocena sa jednom decimalom po jeziku", () => {
    expect(formatRating(translator("sr"), "sr", 4.25)).toBe("4,3");
    expect(formatRating(translator("en"), "en", 4)).toBe("4.0");
    expect(formatRating(translator("en"), "en", null)).toBe("—");
  });

  it("naziv grupe: kategorija po jeziku, status preko prevoda", () => {
    const item = { key: "x", total: 1, nameSr: "Naplata", nameEn: "Billing" };
    const translators = {
      status: (key: string) => `S:${key}`,
      priority: (key: string) => `P:${key}`,
    };
    expect(dimensionLabel("category", item, "sr", translators)).toBe("Naplata");
    expect(dimensionLabel("category", item, "en", translators)).toBe("Billing");
    expect(dimensionLabel("status", { ...item, key: "open" }, "sr", translators)).toBe("S:open");
  });

  it("množina u srpskom za broj ocena i brzi izbor", () => {
    const t = translator("sr");
    expect(t("csat.count", { count: 1 })).toBe("1 ocena");
    expect(t("csat.count", { count: 3 })).toBe("3 ocene");
    expect(t("csat.count", { count: 25 })).toBe("25 ocena");
    expect(t("preset", { count: 30 })).toBe("Poslednjih 30 dana");
  });

  it("sr i en imaju iste ključeve za analitiku", () => {
    /** Svi ključevi objekta, i ugnežđeni (npr. kpi.created). */
    const keys = (value: object, prefix = ""): string[] =>
      Object.entries(value).flatMap(([key, child]) =>
        typeof child === "object" ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`],
      );
    expect(keys(sr.analytics).sort()).toEqual(keys(en.analytics).sort());
  });
});

describe("sortiranje tabele agenata", () => {
  const agent = (
    fullName: string,
    resolvedCount: number,
    avgRating: number | null,
  ): AgentStats => ({
    agentId: fullName,
    fullName,
    role: "agent",
    isActive: true,
    assignedCount: 0,
    resolvedCount,
    avgResolutionMinutes: null,
    avgRating,
    ratingCount: 0,
  });
  const agents = [agent("Bojan", 5, 4.1), agent("Ana", 9, null), agent("Ceca", 2, 4.8)];

  it("po broju rešenih, od najvećeg", () => {
    expect(sortAgents(agents, "resolvedCount", false).map((a) => a.fullName)).toEqual([
      "Ana",
      "Bojan",
      "Ceca",
    ]);
  });

  it("po oceni: prazna ocena je uvek na kraju, u oba smera", () => {
    expect(sortAgents(agents, "avgRating", false).map((a) => a.fullName)).toEqual([
      "Ceca",
      "Bojan",
      "Ana",
    ]);
    expect(sortAgents(agents, "avgRating", true).map((a) => a.fullName)).toEqual([
      "Bojan",
      "Ceca",
      "Ana",
    ]);
  });

  it("po imenu, abecedno; ulazni niz se ne menja", () => {
    expect(sortAgents(agents, "fullName", true).map((a) => a.fullName)).toEqual([
      "Ana",
      "Bojan",
      "Ceca",
    ]);
    expect(agents[0]!.fullName).toBe("Bojan");
  });
});
