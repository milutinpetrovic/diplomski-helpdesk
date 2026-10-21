/**
 * Fajl: src/components/analytics/TicketsTrendChart.tsx
 * Svrha: linijski grafikon „kreirani i rešeni zahtevi“ kroz vreme (FZ-14,
 * trend), po danu ili po nedelji. Dve linije na istoj osi (isti broj
 * zahteva), legenda iznad grafikona, oznaka vrednosti pri prelasku mišem i
 * ispod grafikona ista tabela podataka (za čitač ekrana i štampu).
 * Koristi ga: stranica /analytics. Klijentska komponenta (Recharts crta u pregledaču).
 * Povezano sa: AnalyticsService.trend (oblik TrendPoint), boje --color-chart-1 i
 * --color-chart-2 u globals.css.
 */
"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartDataTable } from "@/components/analytics/ChartDataTable";
import type { TrendBucket } from "@/lib/analytics/period";
import type { TrendPoint } from "@/lib/validation/analytics";

/** Datum "YYYY-MM-DD" kao trenutak u podne (UTC), da zona ne pomeri dan. */
function toDate(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

/**
 * Grafikon trenda.
 * Ulaz: tačke (svaki dan/nedelja, i one sa nulom) i veličina intervala.
 */
export function TicketsTrendChart({
  points,
  bucket,
}: {
  points: TrendPoint[];
  bucket: TrendBucket;
}) {
  const t = useTranslations("analytics.trend");
  // Srpski se piše latinicom: oznaka „sr-Latn“ (samo „sr“ bi dalo ćirilične nazive meseci).
  const locale = useLocale();
  const dateLocale = locale === "sr" ? "sr-Latn" : locale;

  // Korak 1: kratak datum za osu (npr. „21. okt“) i duži za oznaku pri prelasku mišem.
  // Datum je podne po UTC-u, pa se formatira u zoni UTC (isti dan na svakom uređaju).
  const shortFormat = new Intl.DateTimeFormat(dateLocale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const longFormat = new Intl.DateTimeFormat(dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const shortDate = (day: string) => shortFormat.format(toDate(day));
  const longDate = (day: string) => {
    const text = longFormat.format(toDate(day));
    return bucket === "week" ? t("weekOf", { date: text }) : text;
  };

  // Korak 2: prevedeni nazivi serija (legenda i oznaka).
  const created = t("created");
  const resolved = t("resolved");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {bucket === "week" ? t("byWeek") : t("byDay")}
      </p>
      {/* Grafikon je samo slika za oko; isti podaci su u tabeli ispod (aria-hidden). */}
      <div className="h-72 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="bucketStart"
              tickFormatter={shortDate}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              labelFormatter={(label) => longDate(String(label))}
              contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 13 }}
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            />
            <Legend verticalAlign="top" align="left" height={32} iconType="plainline" />
            <Line
              type="monotone"
              dataKey="createdCount"
              name={created}
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
            />
            <Line
              type="monotone"
              dataKey="resolvedCount"
              name={resolved}
              stroke="var(--color-chart-2)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Korak 3: isti podaci kao tabela. */}
      <ChartDataTable
        columns={[t("date"), created, resolved]}
        rows={points.map((point) => [
          longDate(point.bucketStart),
          point.createdCount,
          point.resolvedCount,
        ])}
      />
    </div>
  );
}
