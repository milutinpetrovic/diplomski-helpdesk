/**
 * Fajl: src/components/analytics/CsatChart.tsx
 * Svrha: ocene zadovoljstva korisnika u periodu (FZ-16, CSAT): prosečna
 * ocena kao veliki broj i raspodela ocena od 1 do 5 zvezdica kao stubići,
 * sa brojem iznad svakog stubića.
 * Koristi ga: stranica /analytics. Klijentska komponenta (Recharts).
 * Povezano sa: AnalyticsService.overview (polje csat), analytics-format.ts.
 */
"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { formatRating, type AnalyticsTranslator } from "@/components/analytics/analytics-format";
import { ChartDataTable } from "@/components/analytics/ChartDataTable";
import type { AnalyticsOverview } from "@/lib/validation/analytics";

/** CSAT. Ulaz: deo csat iz AnalyticsOverview (prosek, broj, raspodela). */
export function CsatChart({ csat }: { csat: AnalyticsOverview["csat"] }) {
  const t = useTranslations("analytics.csat");
  const tAnalytics = useTranslations("analytics");
  const locale = useLocale();

  if (csat.count === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  // Korak 1: naziv stubića („5 zvezdica“) za osu, oznaku i tabelu.
  const rows = csat.distribution.map((item) => ({
    label: t("stars", { score: item.score }),
    // Kratka oznaka za osu („5 ★“), da stane i na telefonu.
    short: `${item.score} ★`,
    count: item.count,
  }));
  const average = formatRating(tAnalytics as unknown as AnalyticsTranslator, locale, csat.average);

  return (
    <div className="flex flex-col gap-3">
      {/* Korak 2: prosek i broj ocena. */}
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{average}</span>
        <span className="text-sm text-muted-foreground">
          {t("average", { average })} · {t("count", { count: csat.count })}
        </span>
      </p>

      {/* Korak 3: stubići 1–5 (samo za oko; isti brojevi su u tabeli). */}
      <div className="h-48 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 8 }}>
            <XAxis
              dataKey="short"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 13 }}
            />
            <Bar
              dataKey="count"
              name={t("countColumn")}
              fill="var(--color-chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            >
              <LabelList dataKey="count" position="top" fill="var(--foreground)" fontSize={13} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable
        columns={[t("score"), t("countColumn")]}
        rows={rows.map((row) => [row.label, row.count])}
      />
    </div>
  );
}
