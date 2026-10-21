/**
 * Fajl: src/services/analytics/analytics-service.ts
 * Svrha: AnalyticsService — analitika rada tima podrške za izabrani period
 * (UC-23, FZ-14–FZ-16): KPI brojevi i CSAT, raspodela zahteva po statusu,
 * kategoriji ili prioritetu, učinak po agentu i trend kreiranih i rešenih.
 * Brojeve računa baza (RPC funkcije analytics_*, jedan upit po metodi), a
 * servis dopunjuje podrazumevani period, nule i nazive kategorija.
 * Samo admin: servis to proverava odmah (jasna greška), a baza ponovo.
 * Koriste ga: rute u src/app/api/analytics/ i stranica /analytics.
 * Povezano sa: docs/03 (klasa AnalyticsService), src/lib/validation/analytics.ts,
 * supabase/migrations/..._analytics.sql.
 */
import {
  defaultBucket,
  resolveRange,
  type DateRange,
  type TrendBucket,
} from "@/lib/analytics/period";
import { AppError, fromDbError } from "@/lib/errors/app-error";
import type {
  AgentStats,
  AnalyticsDimension,
  AnalyticsOverview,
  CountItem,
  TrendPoint,
} from "@/lib/validation/analytics";
import { fillDimension, toAgentStats, toOverview } from "@/services/analytics/analytics-mappers";
import { CategoryService } from "@/services/categories/category-service";
import type { ServiceContext } from "@/services/service-context";

/** Servis za analitiku. Uloge: samo admin. */
export class AnalyticsService {
  /**
   * Ulaz: ServiceContext.
   * Baca: FORBIDDEN ako pozivalac nije admin.
   */
  constructor(private readonly ctx: ServiceContext) {
    if (!ctx.auth.isAdmin()) throw new AppError("FORBIDDEN");
  }

  /**
   * KPI kartice i CSAT (GET /api/analytics/overview).
   * Ulaz: period (nepotpun se dopunjuje: podrazumevano poslednjih 30 dana).
   */
  async overview(input: Partial<DateRange>): Promise<AnalyticsOverview> {
    // Korak 1: ceo period.
    const range = resolveRange(input);

    // Korak 2: jedan red iz baze.
    const { data, error } = await this.ctx.db
      .rpc("analytics_overview", { p_from: range.from, p_to: range.to })
      .single();
    if (error) throw fromDbError(error);

    // Korak 3: oblik za API.
    return toOverview(range, data);
  }

  /**
   * Raspodela zahteva kreiranih u periodu (GET /api/analytics/by-dimension).
   * Ulaz: period i dimenzija (status | category | priority).
   * Vraća: sve vrednosti dimenzije, i one sa nulom.
   */
  async byDimension(
    input: Partial<DateRange>,
    dimension: AnalyticsDimension,
  ): Promise<CountItem[]> {
    const range = resolveRange(input);

    // Korak 1: brojevi iz baze i (za kategorije) nazivi, paralelno.
    const [result, categories] = await Promise.all([
      this.ctx.db.rpc("analytics_by_dimension", {
        p_from: range.from,
        p_to: range.to,
        p_dimension: dimension,
      }),
      dimension === "category" ? new CategoryService(this.ctx).listAll() : Promise.resolve([]),
    ]);
    if (result.error) throw fromDbError(result.error);

    // Korak 2: dopuna nulama i nazivi.
    return fillDimension(dimension, result.data, categories);
  }

  /**
   * Učinak tima po agentu (GET /api/analytics/agents): dodeljeno, rešeno,
   * prosečno vreme rešavanja, prosečna ocena. Najviše rešenih prvo.
   */
  async agents(input: Partial<DateRange>): Promise<AgentStats[]> {
    const range = resolveRange(input);
    const { data, error } = await this.ctx.db.rpc("analytics_agents", {
      p_from: range.from,
      p_to: range.to,
    });
    if (error) throw fromDbError(error);
    return data.map(toAgentStats);
  }

  /**
   * Trend kreiranih i rešenih zahteva (GET /api/analytics/trend).
   * Ulaz: period i veličina intervala (bez nje: po danu do 62 dana, inače po nedelji).
   * Vraća: tačku za svaki dan/nedelju u periodu, i one sa nulom.
   */
  async trend(input: Partial<DateRange>, bucket?: TrendBucket): Promise<TrendPoint[]> {
    const range = resolveRange(input);
    const { data, error } = await this.ctx.db.rpc("analytics_trend", {
      p_from: range.from,
      p_to: range.to,
      p_bucket: bucket ?? defaultBucket(range),
    });
    if (error) throw fromDbError(error);
    return data.map((row) => ({
      bucketStart: row.bucket_start,
      createdCount: row.created_count,
      resolvedCount: row.resolved_count,
    }));
  }
}
