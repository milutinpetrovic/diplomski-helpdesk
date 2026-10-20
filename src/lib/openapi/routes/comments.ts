/**
 * Fajl: src/lib/openapi/routes/comments.ts
 * Svrha: Swagger dokumentacija ruta za komentare (tag Comments).
 * Povezano sa: src/app/api/tickets/[id]/comments/route.ts,
 * src/lib/validation/comments.ts, docs/06 (sekcija Komentari).
 */
import { z } from "zod";

import {
  bearerAuth,
  errorResponses,
  jsonBody,
  jsonResponse,
  registry,
} from "@/lib/openapi/registry";
import { addCommentSchema, commentSchema } from "@/lib/validation/comments";
import { idParamsSchema } from "@/lib/validation/common";

// GET /api/tickets/{id}/comments — lista komentara (UC-11).
registry.registerPath({
  method: "get",
  path: "/api/tickets/{id}/comments",
  tags: ["Comments"],
  summary: "Komentari na zahtevu",
  description:
    "Komentari od najstarijeg, sa imenom autora. Korisnik ne dobija interne beleške " +
    "(isInternal = true) — to garantuje RLS politika u bazi. Uloge: customer (svoj zahtev), " +
    "agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParamsSchema },
  responses: {
    200: jsonResponse("Komentari.", z.array(commentSchema)),
    ...errorResponses([400, 401, 403, 404], { 404: "TICKET_NOT_FOUND" }),
  },
});

// POST /api/tickets/{id}/comments — novi komentar (UC-12, UC-18).
registry.registerPath({
  method: "post",
  path: "/api/tickets/{id}/comments",
  tags: ["Comments"],
  summary: "Novi komentar",
  description:
    "Dodaje javni komentar ili internu belešku (isInternal, samo agent i admin). Prvi javni " +
    "odgovor tima upisuje firstResponseAt; kad vlasnik odgovori na zahtev u statusu " +
    "waiting_on_customer, zahtev se vraća u in_progress. Zatvoren zahtev se ne komentariše. " +
    "Uloge: customer (svoj zahtev), agent, admin.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParamsSchema,
    body: jsonBody(addCommentSchema, {
      body: "Da li ste probali ponovo da pokrenete ruter?",
      isInternal: false,
    }),
  },
  responses: {
    201: jsonResponse("Dodat komentar.", commentSchema),
    ...errorResponses([400, 401, 403, 404, 409], {
      403: "FORBIDDEN_INTERNAL_COMMENT",
      404: "TICKET_NOT_FOUND",
      409: "TICKET_CLOSED",
    }),
  },
});
