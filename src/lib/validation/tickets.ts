/**
 * Fajl: src/lib/validation/tickets.ts
 * Svrha: Zod šeme za zahteve (tikete):
 *   - ulaz: kreiranje, izmena, promena statusa, dodela, filteri liste
 *   - izlaz: oblik zahteva u listi, u detaljima (sa dozvolama) i stavke istorije
 * Ista šema se koristi u formi (react-hook-form), u API ruti (withApi) i u
 * Swagger-u (src/lib/openapi/routes/tickets.ts). Poruke grešaka su ključevi
 * prevoda (messages/*.json -> validation.<ključ>).
 * Povezano sa: TicketService, tabela tickets (iste granice dužine kao CHECK
 * ograničenja), docs/06-api-i-stranice.md (sekcije Zahtevi i 3).
 */
import { z } from "zod";

import { categorySchema } from "@/lib/validation/categories";
import {
  paginatedSchema,
  paginationSchema,
  profileSummarySchema,
  uuidSchema,
} from "@/lib/validation/common";
import { ticketRatingSchema } from "@/lib/validation/ratings";
import { HISTORY_ACTIONS, TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/domain";

/** Ključevi poruka grešaka (messages/*.json -> validation.<ključ>). */
export const TICKET_VALIDATION_KEYS = {
  required: "required",
  invalid: "invalid",
  titleLength: "titleLength",
  descriptionLength: "descriptionLength",
} as const;

/** Status zahteva (enum ticket_status). */
export const ticketStatusSchema = z.enum(TICKET_STATUSES).meta({ example: "open" });

/** Prioritet zahteva (enum ticket_priority). */
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES).meta({ example: "medium" });

/** Naslov: 5–150 znakova (razmaci na krajevima se uklanjaju). */
const titleSchema = z
  .string({ error: TICKET_VALIDATION_KEYS.required })
  .trim()
  .min(5, { error: TICKET_VALIDATION_KEYS.titleLength })
  .max(150, { error: TICKET_VALIDATION_KEYS.titleLength })
  .meta({ example: "Ne radi štampač u kancelariji 12" });

/** Opis problema: 10–5000 znakova. */
const descriptionSchema = z
  .string({ error: TICKET_VALIDATION_KEYS.required })
  .trim()
  .min(10, { error: TICKET_VALIDATION_KEYS.descriptionLength })
  .max(5000, { error: TICKET_VALIDATION_KEYS.descriptionLength })
  .meta({ example: "Od jutros štampač javlja grešku E-04 i ne štampa ništa." });

/** Kategorija: ID postojeće aktivne kategorije (proverava baza). */
const categoryIdSchema = z
  .uuid({ error: TICKET_VALIDATION_KEYS.required })
  .meta({ example: "10000000-0000-4000-8000-000000000001" });

/** POST /api/tickets — novi zahtev (UC-09). Prioritet je podrazumevano srednji. */
export const createTicketSchema = z
  .strictObject({
    title: titleSchema,
    description: descriptionSchema,
    categoryId: categoryIdSchema,
    priority: ticketPrioritySchema.default("medium"),
  })
  .meta({ id: "CreateTicketInput", description: "Podaci za novi zahtev (UC-09)." });

/**
 * PATCH /api/tickets/{id} — izmena zahteva; sva polja su opciona, ali mora
 * postojati bar jedno. Korisnik sme da menja samo naslov i opis dok je
 * zahtev otvoren (proverava TicketAccessPolicy i baza).
 */
export const updateTicketSchema = z
  .strictObject({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    categoryId: categoryIdSchema.optional(),
    priority: ticketPrioritySchema.optional().meta({ example: "high" }),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    error: TICKET_VALIDATION_KEYS.required,
  })
  .meta({ id: "UpdateTicketInput", description: "Izmena zahteva (bar jedno polje)." });

/** POST /api/tickets/{id}/status — novi status (UC-13, UC-17). */
export const changeStatusSchema = z
  .strictObject({ status: ticketStatusSchema.meta({ example: "resolved" }) })
  .meta({ id: "ChangeStatusInput", description: "Novi status zahteva." });

/**
 * POST /api/tickets/{id}/assign — dodela (UC-16, UC-20).
 * Agent šalje svoj ID (preuzimanje); admin ID bilo kog člana tima ili null
 * (oslobađanje zahteva).
 */
export const assignTicketSchema = z
  .strictObject({
    assigneeId: uuidSchema.nullable().meta({
      description: "ID agenta/admina; null = oslobodi zahtev (samo admin).",
      example: "00000000-0000-4000-8000-000000000002",
    }),
  })
  .meta({ id: "AssignTicketInput", description: "Kome se zahtev dodeljuje." });

/**
 * Posebna vrednost filtera status: svi nerešeni zahtevi (open, in_progress,
 * waiting_on_customer). Na nju vode brojevi „Otvoreni“, „Nedodeljeni“ i
 * „Hitni“ sa kontrolnog panela, da lista pokaže tačno one zahteve koji su prebrojani.
 */
export const UNRESOLVED_FILTER = "unresolved";

/** Dozvoljena sortiranja liste; minus znači opadajuće (najnoviji / najhitniji prvo). */
export const TICKET_SORTS = [
  "-createdAt",
  "createdAt",
  "-updatedAt",
  "updatedAt",
  "-priority",
  "priority",
] as const;

export type TicketSort = (typeof TICKET_SORTS)[number];

/**
 * GET /api/tickets — filteri, pretraga, sortiranje i paginacija (FZ-10).
 * Prazan parametar (npr. ?status=) se tretira kao da nije poslat.
 */
export const ticketListQuerySchema = paginationSchema.extend({
  status: z
    .union([ticketStatusSchema, z.literal(UNRESOLVED_FILTER)])
    .optional()
    .meta({
      description:
        "Samo zahtevi u ovom statusu; unresolved = svi nerešeni (open, in_progress, " +
        "waiting_on_customer).",
      example: "unresolved",
    }),
  priority: ticketPrioritySchema.optional().meta({ description: "Samo zahtevi ovog prioriteta." }),
  categoryId: uuidSchema.optional().meta({
    description: "Samo zahtevi ove kategorije.",
    example: "10000000-0000-4000-8000-000000000001",
  }),
  assigneeId: z
    .union([z.enum(["me", "unassigned"]), z.uuid()])
    .optional()
    .meta({
      description: "Dodeljen: me (meni), unassigned (nikome) ili ID agenta.",
      example: "unassigned",
    }),
  q: z.string().trim().max(100).optional().meta({
    description: "Pretraga po naslovu i opisu (početak reči); #1042 traži po broju zahteva.",
    example: "štampač",
  }),
  sort: z
    .enum(TICKET_SORTS)
    .default("-createdAt")
    .meta({ description: "Sortiranje; minus = opadajuće.", example: "-createdAt" }),
});

/** Zahtev u odgovoru API-ja (kolone tabele tickets u camelCase obliku). */
export const ticketSchema = z
  .object({
    id: uuidSchema,
    number: z.number().int().meta({ description: "Čitljiv broj (#1001).", example: 1001 }),
    title: z.string().meta({ example: "Ne radi štampač u kancelariji 12" }),
    description: z.string().meta({ example: "Od jutros štampač javlja grešku E-04." }),
    status: ticketStatusSchema,
    priority: ticketPrioritySchema,
    categoryId: uuidSchema.meta({ example: "10000000-0000-4000-8000-000000000001" }),
    createdBy: uuidSchema.meta({ example: "00000000-0000-4000-8000-000000000004" }),
    assignedTo: uuidSchema.nullable().meta({ example: null }),
    firstResponseAt: z.string().nullable().meta({ description: "Prvi javni odgovor tima." }),
    resolvedAt: z.string().nullable().meta({ description: "Poslednji prelaz u resolved." }),
    closedAt: z.string().nullable().meta({ description: "Prelaz u closed." }),
    createdAt: z.string().meta({ example: "2026-10-20T18:00:00.000Z" }),
    updatedAt: z.string().meta({ example: "2026-10-20T18:00:00.000Z" }),
  })
  .meta({ id: "Ticket", description: "Zahtev za podršku." });

/** Stavka liste zahteva: osnovni podaci + kategorija, podnosilac i dodeljeni agent. */
export const ticketListItemSchema = ticketSchema
  .pick({
    id: true,
    number: true,
    title: true,
    status: true,
    priority: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    category: categorySchema.nullable(),
    creator: profileSummarySchema.nullable(),
    assignee: profileSummarySchema.nullable(),
  })
  .meta({ id: "TicketListItem", description: "Zahtev u listi." });

/** Stranica liste zahteva. */
export const ticketListSchema = paginatedSchema(ticketListItemSchema, "PaginatedTicketList");

/** Šta prijavljeni korisnik sme sa zahtevom (TicketAccessPolicy). */
export const ticketPermissionsSchema = z
  .object({
    allowedTransitions: z
      .array(ticketStatusSchema)
      .meta({ description: "Statusi u koje sme ručno da prebaci zahtev.", example: ["closed"] }),
    canComment: z.boolean().meta({ example: true }),
    canCommentInternal: z.boolean().meta({ example: false }),
    canAssign: z.boolean().meta({ example: false }),
    canRate: z.boolean().meta({ example: false }),
    canEdit: z.boolean().meta({ example: true }),
  })
  .meta({ id: "TicketPermissions", description: "Dozvoljene akcije za prijavljenog korisnika." });

/** Detalji zahteva: sve kolone + povezani podaci + dozvoljene akcije. */
export const ticketDetailSchema = ticketSchema
  .extend({
    category: categorySchema.nullable(),
    creator: profileSummarySchema.nullable(),
    assignee: profileSummarySchema.nullable(),
    rating: ticketRatingSchema.nullable(),
    permissions: ticketPermissionsSchema,
  })
  .meta({ id: "TicketDetail", description: "Zahtev sa povezanim podacima i dozvolama." });

/** Stavka istorije zahteva (audit log, FZ-9). */
export const ticketHistoryEntrySchema = z
  .object({
    id: uuidSchema.meta({ example: "50000000-0000-4000-8000-000000000001" }),
    action: z.enum(HISTORY_ACTIONS).meta({ example: "status_changed" }),
    actor: profileSummarySchema
      .nullable()
      .meta({ description: "Ko je izvršio promenu; null = sistem (automatski prelaz)." }),
    assignee: profileSummarySchema.nullable().meta({
      description: "Za assigned/unassigned: agent kome je zahtev dodeljen ili oduzet.",
    }),
    oldValue: z
      .record(z.string(), z.unknown())
      .nullable()
      .meta({ example: { status: "in_progress" } }),
    newValue: z
      .record(z.string(), z.unknown())
      .nullable()
      .meta({ example: { status: "resolved" } }),
    createdAt: z.string().meta({ example: "2026-10-20T18:00:00.000Z" }),
  })
  .meta({ id: "TicketHistoryEntry", description: "Jedna promena na zahtevu." });

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type TicketListItem = z.infer<typeof ticketListItemSchema>;
export type TicketPermissionsDto = z.infer<typeof ticketPermissionsSchema>;
export type TicketDetail = z.infer<typeof ticketDetailSchema>;
export type TicketHistoryEntry = z.infer<typeof ticketHistoryEntrySchema>;
