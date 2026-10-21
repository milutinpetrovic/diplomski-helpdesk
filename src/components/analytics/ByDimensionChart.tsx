/**
 * Fajl: src/components/analytics/ByDimensionChart.tsx
 * Svrha: raspodela zahteva kreiranih u periodu po statusu, kategoriji ili
 * prioritetu (FZ-14). Vodoravne trake (nazivi grupa se lako čitaju i na
 * telefonu), broj na kraju svake trake i prekidač dimenzije iznad grafikona.
 * Sve tri raspodele stižu sa servera odjednom, pa prekidač radi bez čekanja.
 * Koristi ga: stranica /analytics. Klijentska komponenta (prekidač i Recharts).
 * Povezano sa: AnalyticsService.byDimension (oblik CountItem), analytics-format.ts.
 */
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { dimensionLabel } from "@/components/analytics/analytics-format";
import { ChartDataTable } from "@/components/analytics/ChartDataTable";
import { Button } from "@/components/ui/button";
import {
  ANALYTICS_DIMENSIONS,
  type AnalyticsDimension,
  type CountItem,
} from "@/lib/validation/analytics";

/** Visina jedne trake sa razmakom (px). */
const ROW_HEIGHT = 40;

/**
 * Grafikon raspodele.
 * Ulaz: raspodela za svaku dimenziju (status, category, priority).
 */
export function ByDimensionChart({ data }: { data: Record<AnalyticsDimension, CountItem[]> }) {
  const t = useTranslations();
  const locale = useLocale();
  const [dimension, setDimension] = useState<AnalyticsDimension>("category");

  // Korak 1: prevedeni nazivi grupa za izabranu dimenziju.
  const rows = data[dimension].map((item) => ({
    label: dimensionLabel(dimension, item, locale, {
      status: (key) => t(`ticketStatus.${key}`),
      priority: (key) => t(`ticketPriority.${key}`),
    }),
    total: item.total,
  }));
  const isEmpty = rows.every((row) => row.total === 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Korak 2: prekidač dimenzije (dugme koje je uključeno ima aria-pressed). */}
      <div
        role="group"
        aria-label={t("analytics.dimension.label")}
        className="flex flex-wrap gap-2"
      >
        {ANALYTICS_DIMENSIONS.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={option === dimension ? "default" : "outline"}
            aria-pressed={option === dimension}
            onClick={() => setDimension(option)}
          >
            {t(`analytics.dimension.${option}`)}
          </Button>
        ))}
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">{t("analytics.dimension.empty")}</p>
      ) : (
        <>
          {/* Korak 3: trake; visina raste sa brojem grupa. */}
          <div
            style={{ height: rows.length * ROW_HEIGHT + 8 }}
            className="w-full"
            aria-hidden="true"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={150}
                  tick={{ fontSize: 13, fill: "var(--foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 13 }}
                />
                <Bar
                  dataKey="total"
                  name={t("analytics.dimension.count")}
                  fill="var(--color-chart-1)"
                  radius={[0, 4, 4, 0]}
                  barSize={22}
                >
                  <LabelList
                    dataKey="total"
                    position="right"
                    fill="var(--foreground)"
                    fontSize={13}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartDataTable
            columns={[t("analytics.dimension.group"), t("analytics.dimension.count")]}
            rows={rows.map((row) => [row.label, row.total])}
          />
        </>
      )}
    </div>
  );
}
