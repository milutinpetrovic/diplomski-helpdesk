/**
 * Fajl: src/components/analytics/analytics-format.ts
 * Svrha: prikaz brojeva analitike na izabranom jeziku:
 *   - trajanje iz minuta u čitljiv oblik („45 min“, „2 h 15 min“, „3 d 4 h“)
 *   - prosečna ocena sa jednom decimalom („4,3“ na srpskom, „4.3“ na engleskom)
 *   - naziv grupe u raspodeli (status, prioritet ili kategorija, preveden)
 * Čiste funkcije: tekst dobijaju preko funkcije prevoda, pa se testiraju
 * bez React-a (tests/unit/analytics.test.ts).
 * Koriste ga: KpiCards, AgentsTable, CsatChart, ByDimensionChart.
 */
import type { AnalyticsDimension, CountItem } from "@/lib/validation/analytics";

/** Funkcija prevoda za grupu analytics (kao iz useTranslations("analytics")). */
export type AnalyticsTranslator = (key: string, values?: Record<string, string | number>) => string;

/**
 * Trajanje iz minuta. Ulaz: funkcija prevoda i broj minuta (null = nema podataka).
 * Vraća: npr. „2 h 15 min“; „—“ kad nema podataka.
 */
export function formatDuration(t: AnalyticsTranslator, minutes: number | null): string {
  if (minutes === null) return t("noData");
  // Korak 1: zaokruživanje na ceo minut.
  const total = Math.max(0, Math.round(minutes));
  // Korak 2: do sat vremena samo minuti, do dana sati i minuti, posle toga dani i sati.
  if (total < 60) return t("duration.minutes", { m: total });
  if (total < 24 * 60) return t("duration.hours", { h: Math.floor(total / 60), m: total % 60 });
  const hours = Math.round(total / 60);
  return t("duration.days", { d: Math.floor(hours / 24), h: hours % 24 });
}

/** Prosečna ocena sa jednom decimalom na jeziku interfejsa; „—“ kad je null. */
export function formatRating(t: AnalyticsTranslator, locale: string, value: number | null): string {
  if (value === null) return t("noData");
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Prevodi za status i prioritet (grupe ticketStatus i ticketPriority). */
export interface DimensionTranslators {
  status: (key: string) => string;
  priority: (key: string) => string;
}

/**
 * Naziv grupe u raspodeli na jeziku interfejsa.
 * Ulaz: dimenzija, stavka, jezik i prevodi za status/prioritet.
 */
export function dimensionLabel(
  dimension: AnalyticsDimension,
  item: CountItem,
  locale: string,
  translators: DimensionTranslators,
): string {
  if (dimension === "category") return (locale === "sr" ? item.nameSr : item.nameEn) ?? item.key;
  return translators[dimension](item.key);
}
