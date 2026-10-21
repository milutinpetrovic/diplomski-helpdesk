/**
 * Fajl: src/services/analytics/analytics-mappers.ts
 * Svrha: čiste funkcije koje redove iz RPC funkcija analytics_* pretvaraju u
 * oblik za API (camelCase) i dopunjuju raspodelu nulama, da grafikon uvek
 * prikaže sve statuse, prioritete i kategorije (i one bez zahteva).
 * Bez baze, pa se testiraju unit testovima (tests/unit/analytics.test.ts).
 * Koristi ga: AnalyticsService.
 * Povezano sa: src/lib/validation/analytics.ts (oblici odgovora).
 */
import type { DateRange } from "@/lib/analytics/period";
import {
  DIMENSION_VALUES,
  type AgentStats,
  type AnalyticsDimension,
  type AnalyticsOverview,
  type CountItem,
} from "@/lib/validation/analytics";
import type { Category } from "@/lib/validation/categories";
import type { Database } from "@/types/database";

/** Tipovi redova koje vraćaju RPC funkcije (generisani iz baze). */
type Functions = Database["public"]["Functions"];
export type OverviewRow = Functions["analytics_overview"]["Returns"][number];
export type DimensionRow = Functions["analytics_by_dimension"]["Returns"][number];
export type AgentRow = Functions["analytics_agents"]["Returns"][number];

/**
 * Broj iz baze ili null. Generisani tipovi tvrde da je vrednost uvek broj,
 * ali prosek nad praznim skupom u Postgresu je null.
 */
function nullableNumber(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/**
 * KPI red -> AnalyticsOverview.
 * Ulaz: period (vraća se u odgovoru) i red iz analytics_overview.
 */
export function toOverview(range: DateRange, row: OverviewRow): AnalyticsOverview {
  // Raspodela ocena: baza vraća niz od 5 brojeva (ocene 1..5).
  const distribution = [1, 2, 3, 4, 5].map((score, index) => ({
    score,
    count: row.rating_distribution?.[index] ?? 0,
  }));
  return {
    from: range.from,
    to: range.to,
    createdCount: row.created_count,
    resolvedCount: row.resolved_count,
    closedCount: row.closed_count,
    openCount: row.open_count,
    avgFirstResponseMinutes: nullableNumber(row.avg_first_response_minutes),
    avgResolutionMinutes: nullableNumber(row.avg_resolution_minutes),
    csat: {
      average: nullableNumber(row.avg_rating),
      count: row.rating_count,
      distribution,
    },
  };
}

/**
 * Raspodela po dimenziji, dopunjena nulama.
 * Ulaz: dimenzija, redovi iz analytics_by_dimension i (za kategorije) spisak
 * svih kategorija sa nazivima.
 * Vraća: status i prioritet redom iz enum-a; kategorije redom za prikaz, s tim
 * da se neaktivna kategorija bez zahteva u periodu izostavlja.
 */
export function fillDimension(
  dimension: AnalyticsDimension,
  rows: DimensionRow[],
  categories: Category[] = [],
): CountItem[] {
  // Korak 1: broj po ključu.
  const totals = new Map(rows.map((row) => [row.key, row.total]));

  // Korak 2: kategorije sa nazivima na oba jezika.
  if (dimension === "category") {
    return categories
      .filter((category) => category.isActive || totals.has(category.id))
      .map((category) => ({
        key: category.id,
        total: totals.get(category.id) ?? 0,
        nameSr: category.nameSr,
        nameEn: category.nameEn,
      }));
  }

  // Korak 3: status ili prioritet — sve vrednosti enum-a, redom.
  return DIMENSION_VALUES[dimension].map((key) => ({
    key,
    total: totals.get(key) ?? 0,
    nameSr: null,
    nameEn: null,
  }));
}

/** Red iz analytics_agents -> AgentStats. */
export function toAgentStats(row: AgentRow): AgentStats {
  return {
    agentId: row.agent_id,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    assignedCount: row.assigned_count,
    resolvedCount: row.resolved_count,
    avgResolutionMinutes: nullableNumber(row.avg_resolution_minutes),
    avgRating: nullableNumber(row.avg_rating),
    ratingCount: row.rating_count,
  };
}
