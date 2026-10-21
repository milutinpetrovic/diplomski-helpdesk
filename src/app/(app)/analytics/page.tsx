/**
 * Fajl: src/app/(app)/analytics/page.tsx
 * Svrha: stranica /analytics — analitika rada tima podrške (UC-23,
 * FZ-14–FZ-16) za izabrani period:
 *   - izbor perioda (poslednjih 7/30/90/180/365 dana ili svoj), u adresi ?from=&to=
 *   - KPI kartice: novi, rešeni, otvoreni, prvi odgovor, rešavanje, CSAT
 *   - trend kreiranih i rešenih (po danu ili nedelji)
 *   - raspodela po statusu, kategoriji i prioritetu
 *   - učinak tima po agentu i raspodela CSAT ocena
 * Podaci se čitaju na serveru preko istog servisa kao rute /api/analytics/*
 * (AnalyticsService), sa istom proverom perioda; grafikoni su klijentske
 * komponente (Recharts).
 * Pristup: admin (proverava analytics/layout.tsx, a servis i baza ponovo).
 */
import { getTranslations } from "next-intl/server";

import { AgentsTable } from "@/components/analytics/AgentsTable";
import { AnalyticsFilters } from "@/components/analytics/AnalyticsFilters";
import { ByDimensionChart } from "@/components/analytics/ByDimensionChart";
import { CsatChart } from "@/components/analytics/CsatChart";
import { KpiCards } from "@/components/analytics/KpiCards";
import { TicketsTrendChart } from "@/components/analytics/TicketsTrendChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultBucket, resolveRange, todayInAppZone } from "@/lib/analytics/period";
import { requireCurrentUser } from "@/lib/auth/server-session";
import { dateRangeQuerySchema } from "@/lib/validation/analytics";
import { AnalyticsService } from "@/services/analytics/analytics-service";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("analytics") };
}

/** Jedan parametar iz adrese kao tekst (ili undefined). */
function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Analitika (serverska komponenta). */
export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const { ctx } = await requireCurrentUser();
  const t = await getTranslations();

  // Korak 1: period iz adrese, ista provera kao u API-ju. Neispravan period
  // (npr. ručno izmenjena adresa) se zamenjuje podrazumevanim, uz poruku.
  const params = await searchParams;
  const parsed = dateRangeQuerySchema.safeParse({
    from: single(params.from) || undefined,
    to: single(params.to) || undefined,
  });
  const today = todayInAppZone();
  const range = resolveRange(parsed.success ? parsed.data : {}, today);
  const bucket = defaultBucket(range);

  // Korak 2: svi podaci paralelno (sedam upita nad bazom, svaki pod RLS-om).
  const service = new AnalyticsService(ctx);
  const [overview, trend, agents, status, category, priority] = await Promise.all([
    service.overview(range),
    service.trend(range, bucket),
    service.agents(range),
    service.byDimension(range, "status"),
    service.byDimension(range, "category"),
    service.byDimension(range, "priority"),
  ]);

  return (
    <>
      <PageHeader title={t("nav.analytics")} description={t("analytics.description")} />
      <div className="flex flex-col gap-6">
        {parsed.success ? null : (
          <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            {t("analytics.invalidRange")}
          </p>
        )}

        {/* key: polja forme se vraćaju na novi period posle brzog izbora. */}
        <AnalyticsFilters key={`${range.from}:${range.to}`} range={range} today={today} />

        <KpiCards data={overview} />

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("analytics.trend.title")}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TicketsTrendChart points={trend} bucket={bucket} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t("analytics.dimension.title")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ByDimensionChart data={{ status, category, priority }} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t("analytics.csat.title")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CsatChart csat={overview.csat} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("analytics.agents.title")}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AgentsTable agents={agents} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
