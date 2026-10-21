/**
 * Fajl: src/lib/openapi/routes/analytics.ts
 * Svrha: Swagger dokumentacija ruta za analitiku rada tima (tag Analytics).
 * Povezano sa: src/app/api/analytics/**, src/lib/validation/analytics.ts,
 * docs/06 (sekcija Dashboard i analitika).
 */
import { z } from "zod";

import { bearerAuth, errorResponses, jsonResponse, registry } from "@/lib/openapi/registry";
import {
  agentStatsSchema,
  analyticsOverviewSchema,
  byDimensionQuerySchema,
  countItemSchema,
  dateRangeQuerySchema,
  trendPointSchema,
  trendQuerySchema,
} from "@/lib/validation/analytics";

/** Zajednička napomena o periodu u opisu svake rute. */
const PERIOD_NOTE =
  "Period: ?from i ?to su datumi (dani po beogradskom vremenu, oba uključena); " +
  "podrazumevano poslednjih 30 dana, najviše 366 dana. Uloge: admin.";

// GET /api/analytics/overview — KPI kartice (UC-23).
registry.registerPath({
  method: "get",
  path: "/api/analytics/overview",
  tags: ["Analytics"],
  summary: "KPI brojevi i CSAT",
  description:
    "Broj kreiranih, rešenih i zatvorenih zahteva u periodu, trenutno nerešenih, " +
    "prosečno vreme prvog odgovora i rešavanja (u minutima) i CSAT ocene (prosek, " +
    "broj i raspodela 1–5). " +
    PERIOD_NOTE,
  security: [{ [bearerAuth.name]: [] }],
  request: { query: dateRangeQuerySchema },
  responses: {
    200: jsonResponse("KPI brojevi za period.", analyticsOverviewSchema),
    ...errorResponses([400, 401, 403]),
  },
});

// GET /api/analytics/by-dimension — raspodela zahteva (UC-23).
registry.registerPath({
  method: "get",
  path: "/api/analytics/by-dimension",
  tags: ["Analytics"],
  summary: "Raspodela zahteva",
  description:
    "Broj zahteva kreiranih u periodu po statusu, kategoriji ili prioritetu. Vraćaju se " +
    "sve vrednosti (i one sa nulom); za kategorije i nazivi na oba jezika. " +
    PERIOD_NOTE,
  security: [{ [bearerAuth.name]: [] }],
  request: { query: byDimensionQuerySchema },
  responses: {
    200: jsonResponse("Broj zahteva po grupi.", z.array(countItemSchema)),
    ...errorResponses([400, 401, 403]),
  },
});

// GET /api/analytics/agents — učinak po agentu (UC-23).
registry.registerPath({
  method: "get",
  path: "/api/analytics/agents",
  tags: ["Analytics"],
  summary: "Učinak agenata",
  description:
    "Za svakog člana tima: zahtevi kreirani u periodu koji su mu dodeljeni, rešeni u " +
    "periodu, prosečno vreme rešavanja (min) i prosečna CSAT ocena. Računa se po " +
    "trenutno dodeljenom agentu. Najviše rešenih prvo. " +
    PERIOD_NOTE,
  security: [{ [bearerAuth.name]: [] }],
  request: { query: dateRangeQuerySchema },
  responses: {
    200: jsonResponse("Učinak po agentu.", z.array(agentStatsSchema)),
    ...errorResponses([400, 401, 403]),
  },
});

// GET /api/analytics/trend — trend kreiranih i rešenih (UC-23).
registry.registerPath({
  method: "get",
  path: "/api/analytics/trend",
  tags: ["Analytics"],
  summary: "Trend kreiranih i rešenih",
  description:
    "Broj kreiranih i rešenih zahteva za svaki dan (bucket=day) ili nedelju " +
    "(bucket=week, od ponedeljka) u periodu, i za dane bez zahteva (nula). Bez parametra " +
    "bucket: po danu do 62 dana, inače po nedelji. " +
    PERIOD_NOTE,
  security: [{ [bearerAuth.name]: [] }],
  request: { query: trendQuerySchema },
  responses: {
    200: jsonResponse("Tačke trenda.", z.array(trendPointSchema)),
    ...errorResponses([400, 401, 403]),
  },
});
