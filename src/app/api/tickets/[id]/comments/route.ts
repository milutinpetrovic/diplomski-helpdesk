/**
 * Fajl: src/app/api/tickets/[id]/comments/route.ts
 * Svrha: komentari na zahtevu (FZ-8):
 *   - GET  — lista komentara (korisnik ne dobija interne beleške), UC-11
 *   - POST — novi komentar ili interna beleška (UC-12, UC-18)
 * Povezano sa: CommentService, addCommentSchema, RPC add_comment,
 * Swagger (src/lib/openapi/routes/comments.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { addCommentSchema } from "@/lib/validation/comments";
import { idParamsSchema } from "@/lib/validation/common";
import { CommentService } from "@/services/comments/comment-service";
import { USER_ROLES } from "@/types/domain";

/** GET /api/tickets/{id}/comments — komentari od najstarijeg. Uloge: vlasnik, agent, admin. */
export const GET = withApi(
  { roles: USER_ROLES, params: idParamsSchema },
  async ({ ctx, params }) => {
    return new CommentService(ctx).list(params.id);
  },
);

/**
 * POST /api/tickets/{id}/comments — novi komentar (201).
 * Uloge: vlasnik (samo javni), agent i admin (i interne beleške).
 */
export const POST = withApi(
  { roles: USER_ROLES, params: idParamsSchema, body: addCommentSchema, successStatus: 201 },
  async ({ ctx, params, body }) => {
    return new CommentService(ctx).add(params.id, body);
  },
);
