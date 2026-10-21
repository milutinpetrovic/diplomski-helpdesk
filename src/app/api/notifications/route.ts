/**
 * Fajl: src/app/api/notifications/route.ts
 * Svrha: API ruta za listu obaveštenja prijavljenog korisnika (UC-08):
 *   - GET /api/notifications?page&pageSize&unreadOnly
 * Uloge: customer, agent, admin (svako vidi samo svoja obaveštenja).
 * Povezano sa: NotificationService, notificationListQuerySchema,
 * Swagger (src/lib/openapi/routes/notifications.ts), zvonce u zaglavlju.
 */
import { withApi } from "@/lib/api/with-api";
import { notificationListQuerySchema } from "@/lib/validation/notifications";
import { NotificationService } from "@/services/notifications/notification-service";
import { USER_ROLES } from "@/types/domain";

/**
 * GET /api/notifications — stranica obaveštenja (najnovija prva) i broj nepročitanih.
 * Uloge: customer, agent, admin.
 */
export const GET = withApi(
  { roles: USER_ROLES, query: notificationListQuerySchema },
  async ({ ctx, query }) => {
    return new NotificationService(ctx).list(query);
  },
);
