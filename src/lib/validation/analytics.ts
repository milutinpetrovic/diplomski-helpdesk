/**
 * Fajl: src/lib/validation/analytics.ts
 * Svrha: Zod šeme za analitiku rada tima (UC-23, FZ-14–FZ-16):
 *   - ulaz: period ?from&to (datumi, oba uključena; podrazumevano poslednjih
 *     30 dana; "od" nije posle "do"; najviše 366 dana), dimenzija raspodele
 *     i veličina intervala trenda
 *   - izlaz: KPI brojevi (AnalyticsOverview), raspodela (CountItem),
 *     učinak agenata (AgentStats) i tačke trenda (TrendPoint)
 * Sva vremena su u MINUTIMA; prosečne vrednosti su null kad nema podataka.
 * Koriste ga: AnalyticsService, rute u src/app/api/analytics/, Swagger
 * (src/lib/openapi/routes/analytics.ts) i stranica /analytics.
 * Povezano sa: src/lib/analytics/period.ts (pravila perioda),
 * supabase/migrations/..._analytics.sql, docs/06 (sekcija Dashboard i analitika).
 */
import { z } from "zod";

import { rangeError, resolveRange, TREND_BUCKETS } from "@/lib/analytics/period";
import { uuidSchema } from "@/lib/validation/common";
import { TICKET_PRIORITIES, TICKET_STATUSES, USER_ROLES } from "@/types/domain";

/** Ključevi poruka (validation.<ključ> u messages/*.json) za loš period. */
export const ANALYTICS_VALIDATION_KEYS = {
  rangeOrder: "rangeOrder",
  rangeTooLong: "rangeTooLong",
} as const;

/** Datum bez vremena, npr. "2026-10-21" (dan po beogradskom vremenu). */
const dateSchema = z.iso.date();

/** Polja perioda u adresi: ?from=2026-09-22&to=2026-10-21 (oba opciona). */
const rangeFields = {
  from: dateSchema.optional().meta({
    description: "Prvi dan perioda (uključen). Podrazumevano: pre 29 dana.",
    example: "2026-09-22",
  }),
  to: dateSchema.optional().meta({
    description: "Poslednji dan perioda (uključen). Podrazumevano: danas.",
    example: "2026-10-21",
  }),
};

/**
 * Provera celog perioda posle dopune podrazumevanih vrednosti
 * (isto pravilo proverava i baza, funkcija analytics_bounds).
 */
function checkRange(data: { from?: string; to?: string }, ctx: z.RefinementCtx): void {
  const error = rangeError(resolveRange(data));
  if (error)
    ctx.addIssue({ code: "custom", path: ["from"], message: ANALYTICS_VALIDATION_KEYS[error] });
}

/** GET /api/analytics/overview i /agents — samo period. */
export const dateRangeQuerySchema = z.object(rangeFields).superRefine(checkRange);

/** Dimenzija raspodele zahteva. */
export const ANALYTICS_DIMENSIONS = ["status", "category", "priority"] as const;
export type AnalyticsDimension = (typeof ANALYTICS_DIMENSIONS)[number];

/** GET /api/analytics/by-dimension — period i dimenzija. */
export const byDimensionQuerySchema = z
  .object({
    ...rangeFields,
    dimension: z
      .enum(ANALYTICS_DIMENSIONS)
      .meta({ description: "Po čemu se grupišu zahtevi kreirani u periodu.", example: "category" }),
  })
  .superRefine(checkRange);

/** GET /api/analytics/trend — period i (opciono) veličina intervala. */
export const trendQuerySchema = z
  .object({
    ...rangeFields,
    bucket: z.enum(TREND_BUCKETS).optional().meta({
      description:
        "day = po danu, week = po nedelji. Podrazumevano: po danu do 62 dana, inače po nedelji.",
      example: "day",
    }),
  })
  .superRefine(checkRange);

/** Prosečno vreme u minutima (null kad nema podataka). */
const minutesSchema = z.number().nullable();

/** KPI kartice i CSAT za period (odgovor GET /api/analytics/overview). */
export const analyticsOverviewSchema = z
  .object({
    from: dateSchema.meta({ example: "2026-09-22" }),
    to: dateSchema.meta({ example: "2026-10-21" }),
    createdCount: z.number().int().meta({ description: "Kreirano u periodu.", example: 42 }),
    resolvedCount: z.number().int().meta({ description: "Rešeno u periodu.", example: 38 }),
    closedCount: z.number().int().meta({ description: "Zatvoreno u periodu.", example: 30 }),
    openCount: z
      .number()
      .int()
      .meta({ description: "Trenutno nerešenih (ne zavisi od perioda).", example: 9 }),
    avgFirstResponseMinutes: minutesSchema.meta({
      description: "Prosečno vreme do prvog javnog odgovora tima (min).",
      example: 95.5,
    }),
    avgResolutionMinutes: minutesSchema.meta({
      description: "Prosečno vreme od kreiranja do rešenja (min).",
      example: 1260,
    }),
    csat: z.object({
      average: z.number().nullable().meta({ description: "Prosečna ocena 1–5.", example: 4.3 }),
      count: z.number().int().meta({ description: "Broj ocena u periodu.", example: 23 }),
      distribution: z
        .array(z.object({ score: z.number().int(), count: z.number().int() }))
        .meta({ description: "Broj ocena za svaku ocenu od 1 do 5 (uvek 5 stavki)." }),
    }),
  })
  .meta({ id: "AnalyticsOverview", description: "KPI brojevi i CSAT za period." });

/** Jedna grupa raspodele (odgovor GET /api/analytics/by-dimension). */
export const countItemSchema = z
  .object({
    key: z.string().meta({
      description: "Status, prioritet ili ID kategorije.",
      example: "10000000-0000-4000-8000-000000000001",
    }),
    total: z.number().int().meta({ example: 12 }),
    nameSr: z.string().nullable().meta({
      description: "Naziv kategorije (samo za dimension=category).",
      example: "Tehnički problem",
    }),
    nameEn: z.string().nullable().meta({ example: "Technical issue" }),
  })
  .meta({ id: "CountItem", description: "Broj zahteva u jednoj grupi." });

/** Učinak jednog člana tima (odgovor GET /api/analytics/agents). */
export const agentStatsSchema = z
  .object({
    agentId: uuidSchema.meta({ example: "00000000-0000-4000-8000-000000000002" }),
    fullName: z.string().meta({ example: "Jelena Agentić" }),
    role: z.enum(USER_ROLES).meta({ example: "agent" }),
    isActive: z.boolean().meta({ example: true }),
    assignedCount: z
      .number()
      .int()
      .meta({ description: "Zahtevi kreirani u periodu koji su mu dodeljeni.", example: 14 }),
    resolvedCount: z
      .number()
      .int()
      .meta({ description: "Njegovi zahtevi rešeni u periodu.", example: 12 }),
    avgResolutionMinutes: minutesSchema.meta({ example: 1340 }),
    avgRating: z.number().nullable().meta({ example: 4.5 }),
    ratingCount: z.number().int().meta({ example: 8 }),
  })
  .meta({ id: "AgentStats", description: "Učinak člana tima podrške u periodu." });

/** Jedna tačka trenda (odgovor GET /api/analytics/trend). */
export const trendPointSchema = z
  .object({
    bucketStart: dateSchema.meta({
      description: "Prvi dan dana ili nedelje.",
      example: "2026-10-20",
    }),
    createdCount: z.number().int().meta({ example: 3 }),
    resolvedCount: z.number().int().meta({ example: 2 }),
  })
  .meta({ id: "TrendPoint", description: "Broj kreiranih i rešenih zahteva u danu/nedelji." });

/** Spisak vrednosti po dimenziji (za dopunu nulama u servisu). */
export const DIMENSION_VALUES = {
  status: TICKET_STATUSES,
  priority: TICKET_PRIORITIES,
} as const;

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type ByDimensionQuery = z.infer<typeof byDimensionQuerySchema>;
export type TrendQuery = z.infer<typeof trendQuerySchema>;
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;
export type CountItem = z.infer<typeof countItemSchema>;
export type AgentStats = z.infer<typeof agentStatsSchema>;
export type TrendPoint = z.infer<typeof trendPointSchema>;
