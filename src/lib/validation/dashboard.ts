/**
 * Fajl: src/lib/validation/dashboard.ts
 * Svrha: Zod šeme za odgovor GET /api/dashboard (kontrolni panel, UC-25).
 * Odgovor ima polje `kind` (customer, agent ili admin) koje kaže koji je
 * oblik podataka, jer svaka uloga vidi drugačiji panel:
 *   - customer: njegovi zahtevi po statusu, „čeka vaš odgovor“, „ocenite“, poslednji
 *   - agent: njegovi zahtevi po statusu, red nedodeljenih, hitni, njegova ocena
 *   - admin: ukupno otvorenih/nedodeljenih/hitnih, opterećenje po agentu
 * Koriste ga: DashboardService, ruta /api/dashboard, Swagger
 * (src/lib/openapi/routes/dashboard.ts) i komponente u src/components/dashboard/.
 * Povezano sa: SQL funkcije ticket_counts i agent_dashboard_stats
 * (supabase/migrations/..._dashboard.sql), docs/06-api-i-stranice.md.
 */
import { z } from "zod";

import { agentSummarySchema } from "@/lib/validation/admin";
import { ticketSchema } from "@/lib/validation/tickets";

/** Broj zahteva za svaki status (svi statusi su uvek prisutni, i sa nulom). */
export const statusCountsSchema = z
  .object({
    open: z.number().int(),
    in_progress: z.number().int(),
    waiting_on_customer: z.number().int(),
    resolved: z.number().int(),
    closed: z.number().int(),
  })
  .meta({
    id: "StatusCounts",
    description: "Broj zahteva po statusu.",
    example: { open: 2, in_progress: 1, waiting_on_customer: 1, resolved: 1, closed: 1 },
  });

/** Kratak prikaz zahteva u listama na panelu (bez opisa i imena). */
export const dashboardTicketSchema = ticketSchema
  .pick({
    id: true,
    number: true,
    title: true,
    status: true,
    priority: true,
    createdAt: true,
    updatedAt: true,
  })
  .meta({ id: "DashboardTicket", description: "Zahtev u listi na kontrolnom panelu." });

/** Panel korisnika. */
export const customerDashboardSchema = z
  .object({
    kind: z.literal("customer"),
    statusCounts: statusCountsSchema,
    waitingOnMe: z
      .array(dashboardTicketSchema)
      .meta({ description: "Zahtevi koji čekaju odgovor korisnika (najviše 5)." }),
    toRate: z
      .array(dashboardTicketSchema)
      .meta({ description: "Rešeni ili zatvoreni zahtevi bez ocene (najviše 5)." }),
    recent: z
      .array(dashboardTicketSchema)
      .meta({ description: "Poslednjih 5 izmenjenih zahteva." }),
  })
  .meta({ id: "CustomerDashboard", description: "Kontrolni panel korisnika." });

/** Panel agenta. */
export const agentDashboardSchema = z
  .object({
    kind: z.literal("agent"),
    // Zahtevi dodeljeni prijavljenom agentu, po statusu.
    myStatusCounts: statusCountsSchema,
    unassignedCount: z
      .number()
      .int()
      .meta({ description: "Nedodeljeni zahtevi koji nisu rešeni ni zatvoreni.", example: 3 }),
    urgentCount: z.number().int().meta({
      description: "Hitni nerešeni zahtevi (ceo tim).",
      example: 1,
    }),
    unassignedQueue: z
      .array(dashboardTicketSchema)
      .meta({ description: "Najstarijih 5 nedodeljenih zahteva (red čekanja)." }),
    urgent: z
      .array(dashboardTicketSchema)
      .meta({ description: "Najstariji hitni nerešeni zahtevi (najviše 5)." }),
    rating: z
      .object({
        average: z.number().nullable().meta({ example: 4.5 }),
        count: z.number().int().meta({ example: 2 }),
      })
      .meta({ description: "Prosečna CSAT ocena zahteva dodeljenih agentu." }),
    resolvedCount: z
      .number()
      .int()
      .meta({ description: "Agentovi zahtevi koji su rešeni ili zatvoreni.", example: 4 }),
  })
  .meta({ id: "AgentDashboard", description: "Kontrolni panel agenta." });

/** Panel administratora. */
export const adminDashboardSchema = z
  .object({
    kind: z.literal("admin"),
    statusCounts: statusCountsSchema,
    openCount: z
      .number()
      .int()
      .meta({ description: "Zahtevi koji nisu rešeni ni zatvoreni.", example: 7 }),
    unassignedCount: z
      .number()
      .int()
      .meta({ description: "Nedodeljeni nerešeni zahtevi.", example: 3 }),
    urgentCount: z.number().int().meta({ description: "Hitni nerešeni zahtevi.", example: 1 }),
    workload: z
      .array(agentSummarySchema)
      .meta({ description: "Opterećenje po članu tima (broj nerešenih dodeljenih)." }),
    unassignedQueue: z
      .array(dashboardTicketSchema)
      .meta({ description: "Najstarijih 5 nedodeljenih zahteva." }),
  })
  .meta({ id: "AdminDashboard", description: "Kontrolni panel administratora." });

/** Odgovor GET /api/dashboard: jedan od tri oblika, po polju kind. */
export const dashboardDataSchema = z
  .discriminatedUnion("kind", [customerDashboardSchema, agentDashboardSchema, adminDashboardSchema])
  .meta({ id: "DashboardData", description: "Podaci kontrolnog panela po ulozi (UC-25)." });

export type StatusCounts = z.infer<typeof statusCountsSchema>;
export type DashboardTicket = z.infer<typeof dashboardTicketSchema>;
export type CustomerDashboard = z.infer<typeof customerDashboardSchema>;
export type AgentDashboard = z.infer<typeof agentDashboardSchema>;
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;
export type DashboardData = z.infer<typeof dashboardDataSchema>;
