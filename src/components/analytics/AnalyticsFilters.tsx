/**
 * Fajl: src/components/analytics/AnalyticsFilters.tsx
 * Svrha: izbor perioda na stranici /analytics (FZ-15): brzi izbori
 * (poslednjih 7, 30, 90, 180, 365 dana) i svoj period (od, do).
 * Period se čuva u adresi (?from=&to=), pa izbor menja adresu, a stranica
 * na serveru ponovo čita podatke. Tako se link sa periodom može poslati
 * i otvara isti prikaz.
 * Koristi ga: stranica /analytics. Klijentska komponenta (forma).
 * Povezano sa: src/lib/analytics/period.ts (pravila perioda, ista kao u API-ju).
 */
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  lastDays,
  matchingPreset,
  RANGE_PRESETS,
  rangeError,
  type DateRange,
} from "@/lib/analytics/period";
import { cn } from "@/lib/utils";

/** Adresa stranice za dati period. */
export function analyticsHref(pathname: string, range: DateRange): string {
  return `${pathname}?${new URLSearchParams({ from: range.from, to: range.to }).toString()}`;
}

/**
 * Izbor perioda.
 * Ulaz: trenutni period (već proveren na serveru) i današnji datum
 * (sa servera, da brzi izbori budu isti kao podrazumevani period).
 */
export function AnalyticsFilters({ range, today }: { range: DateRange; today: string }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  // Polja forme „svoj period“; počinju od trenutnog perioda.
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [error, setError] = useState<string | null>(null);
  const active = matchingPreset(range, today);

  /** Potvrda svog perioda: provera, pa nova adresa. */
  function applyCustom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Korak 1: ista provera kao na serveru (od <= do, najviše 366 dana).
    const problem = !from || !to ? "required" : rangeError({ from, to });
    if (problem) {
      setError(t(`validation.${problem}`));
      return;
    }
    // Korak 2: nova adresa; server učitava podatke za novi period.
    setError(null);
    router.push(analyticsHref(pathname, { from, to }));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-end lg:justify-between">
      {/* Brzi izbori: linkovi, označen je onaj koji odgovara periodu. */}
      <nav aria-label={t("analytics.periodLabel")} className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map((days) => (
          <Button key={days} asChild size="sm" variant={active === days ? "default" : "outline"}>
            <Link
              href={analyticsHref(pathname, lastDays(days, today))}
              aria-current={active === days ? "true" : undefined}
              aria-label={t("analytics.preset", { count: days })}
            >
              {t("analytics.presetShort", { count: days })}
            </Link>
          </Button>
        ))}
      </nav>

      {/* Svoj period: dva datuma i dugme. */}
      <form onSubmit={applyCustom} noValidate className="flex flex-wrap items-end gap-2">
        <fieldset className="contents">
          <legend className="sr-only">{t("analytics.customRange")}</legend>
          <div className="flex flex-col gap-1">
            <Label htmlFor="analytics-from">{t("analytics.from")}</Label>
            <Input
              id="analytics-from"
              type="date"
              value={from}
              max={today}
              onChange={(event) => setFrom(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "analytics-range-error" : undefined}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="analytics-to">{t("analytics.to")}</Label>
            <Input
              id="analytics-to"
              type="date"
              value={to}
              max={today}
              onChange={(event) => setTo(event.target.value)}
              aria-invalid={error ? true : undefined}
              className="w-40"
            />
          </div>
        </fieldset>
        <Button type="submit" size="sm" variant="secondary" className="h-9">
          {t("analytics.apply")}
        </Button>
        <p
          id="analytics-range-error"
          role="alert"
          className={cn("basis-full text-sm text-destructive", !error && "sr-only")}
        >
          {error}
        </p>
      </form>
    </div>
  );
}
