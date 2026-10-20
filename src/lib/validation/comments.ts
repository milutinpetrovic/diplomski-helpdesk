/**
 * Fajl: src/lib/validation/comments.ts
 * Svrha: Zod šeme za komentare na zahtevu: ulaz za POST /api/tickets/{id}/comments
 * (i formu za komentar) i oblik komentara u odgovoru.
 * Koriste ga: CommentService, ruta .../comments i Swagger (routes/comments.ts).
 * Povezano sa: tabela ticket_comments i RPC add_comment (baza proverava iste
 * granice i pravilo da internu belešku piše samo tim podrške).
 */
import { z } from "zod";

import { profileSummarySchema, uuidSchema } from "@/lib/validation/common";

/** Ključevi poruka grešaka (messages/*.json -> validation.<ključ>). */
export const COMMENT_VALIDATION_KEYS = {
  commentLength: "commentLength",
} as const;

/**
 * POST /api/tickets/{id}/comments — tekst 1–5000 znakova; isInternal = true
 * znači internu belešku koju vidi samo tim podrške (korisnik dobija 403).
 */
export const addCommentSchema = z
  .strictObject({
    body: z
      .string({ error: COMMENT_VALIDATION_KEYS.commentLength })
      .trim()
      .min(1, { error: COMMENT_VALIDATION_KEYS.commentLength })
      .max(5000, { error: COMMENT_VALIDATION_KEYS.commentLength })
      .meta({ example: "Da li ste probali ponovo da pokrenete ruter?" }),
    isInternal: z
      .boolean()
      .default(false)
      .meta({ description: "Interna beleška (samo agent i admin).", example: false }),
  })
  .meta({ id: "AddCommentInput", description: "Novi komentar na zahtevu (UC-12, UC-18)." });

/** Komentar u odgovoru API-ja, sa imenom autora. */
export const commentSchema = z
  .object({
    id: uuidSchema.meta({ example: "40000000-0000-4000-8000-000000000001" }),
    ticketId: uuidSchema,
    body: z.string().meta({ example: "Da li ste probali ponovo da pokrenete ruter?" }),
    isInternal: z.boolean().meta({ example: false }),
    createdAt: z.string().meta({ example: "2026-10-20T18:00:00.000Z" }),
    author: profileSummarySchema
      .nullable()
      .meta({ description: "Autor; null ako nalog više nije vidljiv (npr. deaktiviran agent)." }),
  })
  .meta({ id: "CommentWithAuthor", description: "Komentar na zahtevu sa autorom." });

export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type CommentWithAuthor = z.infer<typeof commentSchema>;
