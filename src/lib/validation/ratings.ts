/**
 * Fajl: src/lib/validation/ratings.ts
 * Svrha: Zod šeme za ocenu zadovoljstva (CSAT, FZ-16): ulaz za
 * POST /api/tickets/{id}/rating (i formu sa zvezdicama) i oblik ocene u odgovoru.
 * Koriste ga: RatingService, ruta .../rating, šema detalja zahteva i Swagger.
 * Povezano sa: tabela ticket_ratings i RPC rate_ticket (baza proverava iste granice).
 */
import { z } from "zod";

import { uuidSchema } from "@/lib/validation/common";

/** Ključevi poruka grešaka (messages/*.json -> validation.<ključ>). */
export const RATING_VALIDATION_KEYS = {
  scoreRange: "scoreRange",
  ratingCommentLength: "ratingCommentLength",
} as const;

/** POST /api/tickets/{id}/rating — ocena 1–5 i opcioni komentar (do 1000 znakova). */
export const rateTicketSchema = z
  .strictObject({
    score: z
      .number({ error: RATING_VALIDATION_KEYS.scoreRange })
      .int({ error: RATING_VALIDATION_KEYS.scoreRange })
      .min(1, { error: RATING_VALIDATION_KEYS.scoreRange })
      .max(5, { error: RATING_VALIDATION_KEYS.scoreRange })
      .meta({ description: "Ocena od 1 do 5 zvezdica.", example: 5 }),
    comment: z
      .string()
      .trim()
      .max(1000, { error: RATING_VALIDATION_KEYS.ratingCommentLength })
      .optional()
      .meta({ example: "Brzo i ljubazno, hvala!" }),
  })
  .meta({ id: "RateTicketInput", description: "Ocena rešenog zahteva (UC-14)." });

/** Ocena u odgovoru API-ja. */
export const ticketRatingSchema = z
  .object({
    id: uuidSchema.meta({ example: "30000000-0000-4000-8000-000000000001" }),
    ticketId: uuidSchema,
    ratedBy: uuidSchema.meta({ example: "00000000-0000-4000-8000-000000000004" }),
    score: z.number().int().meta({ example: 5 }),
    comment: z.string().nullable().meta({ example: "Brzo i ljubazno, hvala!" }),
    createdAt: z.string().meta({ example: "2026-10-20T18:00:00.000Z" }),
  })
  .meta({ id: "TicketRating", description: "Ocena zadovoljstva (CSAT 1–5)." });

export type RateTicketInput = z.infer<typeof rateTicketSchema>;
export type TicketRating = z.infer<typeof ticketRatingSchema>;
