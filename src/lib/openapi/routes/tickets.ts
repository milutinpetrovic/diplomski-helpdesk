/**
 * Fajl: src/lib/openapi/routes/tickets.ts
 * Svrha: Swagger dokumentacija ruta za zahteve (tag Tickets): lista,
 * kreiranje, detalji, izmena, promena statusa, dodela i istorija.
 * Šeme su iste Zod šeme koje koriste API rute (src/lib/validation/tickets.ts).
 * Povezano sa: src/app/api/tickets/**, docs/06-api-i-stranice.md (sekcija Zahtevi).
 */
import { z } from "zod";

import {
  bearerAuth,
  errorResponses,
  jsonBody,
  jsonResponse,
  registry,
} from "@/lib/openapi/registry";
import { idParamsSchema } from "@/lib/validation/common";
import {
  assignTicketSchema,
  changeStatusSchema,
  createTicketSchema,
  ticketDetailSchema,
  ticketHistoryEntrySchema,
  ticketListQuerySchema,
  ticketListSchema,
  updateTicketSchema,
} from "@/lib/validation/tickets";

/** Svaka ruta za zahteve traži prijavu (Bearer token u Swagger-u). */
const security = [{ [bearerAuth.name]: [] }];

// GET /api/tickets — lista (UC-10, UC-15, UC-19).
registry.registerPath({
  method: "get",
  path: "/api/tickets",
  tags: ["Tickets"],
  summary: "Lista zahteva",
  description:
    "Stranica zahteva sa filterima (status, prioritet, kategorija, dodeljen), pretragom po " +
    "naslovu i opisu (ili #broju) i sortiranjem. Korisnik dobija samo svoje zahteve, agent i " +
    "admin sve. Uloge: customer, agent, admin.",
  security,
  request: { query: ticketListQuerySchema },
  responses: {
    200: jsonResponse("Stranica zahteva.", ticketListSchema),
    ...errorResponses([400, 401, 403]),
  },
});

// POST /api/tickets — novi zahtev (UC-09).
registry.registerPath({
  method: "post",
  path: "/api/tickets",
  tags: ["Tickets"],
  summary: "Novi zahtev",
  description:
    "Korisnik prijavljuje problem. Zahtev počinje u statusu open, nedodeljen; tim podrške " +
    "dobija obaveštenje. Kategorija mora biti aktivna. Uloga: customer.",
  security,
  request: {
    body: jsonBody(createTicketSchema, {
      title: "Ne radi štampač u kancelariji 12",
      description: "Od jutros štampač javlja grešku E-04 i ne štampa ništa.",
      categoryId: "10000000-0000-4000-8000-000000000001",
      priority: "high",
    }),
  },
  responses: {
    201: jsonResponse("Napravljen zahtev.", ticketDetailSchema),
    ...errorResponses([400, 401, 403]),
  },
});

// GET /api/tickets/{id} — detalji (UC-11).
registry.registerPath({
  method: "get",
  path: "/api/tickets/{id}",
  tags: ["Tickets"],
  summary: "Detalji zahteva",
  description:
    "Zahtev sa kategorijom, podnosiocem, dodeljenim agentom, ocenom i poljem permissions " +
    "(šta prijavljeni korisnik sme: dozvoljeni statusi, komentar, interna beleška, dodela, " +
    "ocena, izmena). Tuđ zahtev vraća 404. Uloge: customer (svoj), agent, admin.",
  security,
  request: { params: idParamsSchema },
  responses: {
    200: jsonResponse("Detalji zahteva.", ticketDetailSchema),
    ...errorResponses([400, 401, 403, 404], { 404: "TICKET_NOT_FOUND" }),
  },
});

// PATCH /api/tickets/{id} — izmena.
registry.registerPath({
  method: "patch",
  path: "/api/tickets/{id}",
  tags: ["Tickets"],
  summary: "Izmena zahteva",
  description:
    "Menja naslov, opis, kategoriju ili prioritet (bar jedno polje). Korisnik sme samo naslov " +
    "i opis svog zahteva dok je open; agent samo dodeljen zahtev; admin svaki. Zatvoren " +
    "zahtev se ne menja. Uloge: customer, agent, admin.",
  security,
  request: { params: idParamsSchema, body: jsonBody(updateTicketSchema, { priority: "high" }) },
  responses: {
    200: jsonResponse("Ažuriran zahtev.", ticketDetailSchema),
    ...errorResponses([400, 401, 403, 404, 409], {
      403: "NOT_ASSIGNED_AGENT",
      404: "TICKET_NOT_FOUND",
      409: "TICKET_CLOSED",
    }),
  },
});

// POST /api/tickets/{id}/status — promena statusa (UC-13, UC-17).
registry.registerPath({
  method: "post",
  path: "/api/tickets/{id}/status",
  tags: ["Tickets"],
  summary: "Promena statusa",
  description:
    "Menja status po tabeli dozvoljenih prelaza (docs/02, sekcija 4). Korisnik: otkazivanje " +
    "(open → closed), potvrda (resolved → closed), ponovno otvaranje (resolved → in_progress). " +
    "Agent: samo dodeljen zahtev. Admin: svi prelazi, i closed → open. Ulazak u resolved/closed " +
    "upisuje resolvedAt/closedAt. Uloge: customer, agent, admin.",
  security,
  request: { params: idParamsSchema, body: jsonBody(changeStatusSchema, { status: "resolved" }) },
  responses: {
    200: jsonResponse("Zahtev sa novim statusom i novim dozvolama.", ticketDetailSchema),
    ...errorResponses([400, 401, 403, 404, 409], {
      403: "NOT_ASSIGNED_AGENT",
      404: "TICKET_NOT_FOUND",
      409: "INVALID_STATUS_TRANSITION",
    }),
  },
});

// POST /api/tickets/{id}/assign — dodela (UC-16, UC-20).
registry.registerPath({
  method: "post",
  path: "/api/tickets/{id}/assign",
  tags: ["Tickets"],
  summary: "Dodela zahteva",
  description:
    "Agent preuzima nedodeljen zahtev (assigneeId = njegov ID). Admin dodeljuje bilo kom " +
    "aktivnom agentu/adminu ili oslobađa zahtev (assigneeId = null). Dodela otvorenog zahteva " +
    "ga prebacuje u in_progress; oslobađanje zahteva u radu ga vraća u open. Uloge: agent, admin.",
  security,
  request: {
    params: idParamsSchema,
    body: jsonBody(assignTicketSchema, { assigneeId: "00000000-0000-4000-8000-000000000002" }),
  },
  responses: {
    200: jsonResponse("Zahtev posle dodele.", ticketDetailSchema),
    ...errorResponses([400, 401, 403, 404, 409], {
      404: "TICKET_NOT_FOUND",
      409: "TICKET_ALREADY_ASSIGNED",
    }),
  },
});

// GET /api/tickets/{id}/history — istorija promena (FZ-9).
registry.registerPath({
  method: "get",
  path: "/api/tickets/{id}/history",
  tags: ["Tickets"],
  summary: "Istorija zahteva",
  description:
    "Sve promene na zahtevu, od najstarije: ko (actor; null = sistem), šta (action, stara i " +
    "nova vrednost) i kada. Ne sadrži tekst komentara. Uloge: customer (svoj), agent, admin.",
  security,
  request: { params: idParamsSchema },
  responses: {
    200: jsonResponse("Stavke istorije.", z.array(ticketHistoryEntrySchema)),
    ...errorResponses([400, 401, 403, 404], { 404: "TICKET_NOT_FOUND" }),
  },
});
