/**
 * Fajl: src/app/api/notifications/[id]/read/route.ts
 * Svrha: API ruta za označavanje jednog obaveštenja kao pročitanog (UC-08).
 * Uloge: customer, agent, admin (samo sopstveno obaveštenje).
 * Povezano sa: NotificationService.markRead, Swagger (routes/notifications.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { notificationIdParamsSchema } from "@/lib/validation/notifications";
import { NotificationService } from "@/services/notifications/notification-service";
import { USER_ROLES } from "@/types/domain";

/**
 * POST /api/notifications/{id}/read — vraća 204; tuđe ili nepostojeće
 * obaveštenje daje 404 NOT_FOUND. Uloge: customer, agent, admin.
 */
export const POST = withApi(
  { roles: USER_ROLES, params: notificationIdParamsSchema },
  async ({ ctx, params }) => {
    await new NotificationService(ctx).markRead(params.id);
  },
);
