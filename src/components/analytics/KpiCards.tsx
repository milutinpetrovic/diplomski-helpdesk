/**
 * Fajl: src/components/analytics/KpiCards.tsx
 * Svrha: glavni pokazatelji na stranici /analytics (FZ-14, FZ-16): novi,
 * rešeni i trenutno otvoreni zahtevi, prosečno vreme prvog odgovora i
 * rešavanja i prosečna CSAT ocena. Jedan broj po kartici, bez grafikona
 * (jedan broj se najbrže čita kao broj).
 * Koristi ga: stranica /analytics. Serverska komponenta.
 * Povezano sa: AnalyticsService.overview (oblik AnalyticsOverview), analytics-format.ts.
 */
import { useLocale, useTranslations } from "next-intl";

import {
  formatDuration,
  formatRating,
  type AnalyticsTranslator,
} from "@/components/analytics/analytics-format";
import type { AnalyticsOverview } from "@/lib/validation/analytics";

/** Jedna kartica: naziv, broj i opciona napomena ispod broja. */
function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <dt className="text-sm">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums sm:text-3xl">{value}</dd>
      {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

/** Šest KPI kartica. Ulaz: podaci iz AnalyticsService.overview. */
export function KpiCards({ data }: { data: AnalyticsOverview }) {
  const t = useTranslations("analytics");
  const locale = useLocale();
  const translate = t as unknown as AnalyticsTranslator;
  const number = new Intl.NumberFormat(locale);

  return (
    // Lista pojmova (dl): čitač ekrana čita naziv pa vrednost.
    // Telefon: dve kolone; tablet i računar: tri; širok ekran: šest u redu.
    <dl
      aria-label={t("kpi.label")}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6"
    >
      <KpiCard label={t("kpi.created")} value={number.format(data.createdCount)} />
      <KpiCard
        label={t("kpi.resolved")}
        value={number.format(data.resolvedCount)}
        hint={t("kpi.closedHint", { count: data.closedCount })}
      />
      <KpiCard
        label={t("kpi.open")}
        value={number.format(data.openCount)}
        hint={t("kpi.openHint")}
      />
      <KpiCard
        label={t("kpi.firstResponse")}
        value={formatDuration(translate, data.avgFirstResponseMinutes)}
      />
      <KpiCard
        label={t("kpi.resolution")}
        value={formatDuration(translate, data.avgResolutionMinutes)}
      />
      <KpiCard
        label={t("kpi.csat")}
        value={formatRating(translate, locale, data.csat.average)}
        hint={t("csat.count", { count: data.csat.count })}
      />
    </dl>
  );
}
