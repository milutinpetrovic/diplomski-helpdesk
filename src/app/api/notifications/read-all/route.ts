/**
 * Fajl: src/app/api/notifications/read-all/route.ts
 * Svrha: API ruta za označavanje svih obaveštenja kao pročitanih (UC-08,
 * dugme „Označi sve kao pročitano“ u zvoncetu i na stranici /notifications).
 * Uloge: customer, agent, admin (samo sopstvena obaveštenja).
 * Povezano sa: NotificationService.markAllRead, Swagger (routes/notifications.ts).
 */
import { withApi } from "@/lib/api/with-api";
import { NotificationService } from "@/services/notifications/notification-service";
import { USER_ROLES } from "@/types/domain";

/** POST /api/notifications/read-all — vraća 204. Uloge: customer, agent, admin. */
export const POST = withApi({ roles: USER_ROLES }, async ({ ctx }) => {
  await new NotificationService(ctx).markAllRead();
});
