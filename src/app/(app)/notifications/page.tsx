/**
 * Fajl: src/app/(app)/notifications/page.tsx
 * Svrha: stranica /notifications — sva obaveštenja prijavljenog korisnika
 * (UC-08), po 20 na strani, sa filterom „Nepročitana“ (?unreadOnly=true).
 * Podaci se čitaju na serveru preko istog servisa kao GET /api/notifications
 * (NotificationService.list), pa važe ista pravila (RLS: samo sopstvena).
 * Pristup: customer, agent, admin.
 * Povezano sa: NotificationList, notification-params.ts, NotificationBell
 * (nova obaveštenja osvežavaju ovu stranicu bez reload-a).
 */
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/PageHeader";
import { NotificationList } from "@/components/notifications/NotificationList";
import { parseNotificationParams } from "@/components/notifications/notification-params";
import { requireCurrentUser } from "@/lib/auth/server-session";
import { NotificationService } from "@/services/notifications/notification-service";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

/** Stranica obaveštenja (serverska komponenta; lista je klijentska zbog klikova). */
export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const { ctx } = await requireCurrentUser();
  const t = await getTranslations("notifications");

  // Korak 1: filter i strana iz adrese (neispravni parametri se zanemaruju).
  const query = parseNotificationParams(await searchParams);

  // Korak 2: obaveštenja (najnovija prva) i broj nepročitanih.
  const page = await new NotificationService(ctx).list(query);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <NotificationList page={page} unreadOnly={query.unreadOnly === "true"} />
    </>
  );
}
