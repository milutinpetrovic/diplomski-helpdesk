/**
 * Fajl: src/app/(app)/dashboard/page.tsx
 * Svrha: stranica /dashboard — kontrolni panel (UC-25), prva stranica posle
 * prijave. Svaka uloga vidi svoj panel:
 *   - korisnik: svoji zahtevi po statusu, šta čeka njega, poslednji zahtevi
 *   - agent: red rada (dodeljeni, nedodeljeni, hitni) i svoja ocena
 *   - admin: stanje svih zahteva i opterećenje tima
 * Podaci se čitaju na serveru preko istog servisa kao GET /api/dashboard.
 * Osvežava se bez reload-a kad stigne obaveštenje ili događaj tima (Faza 7,
 * NotificationBell i StaffLiveRefresh u zaglavlju).
 * Pristup: customer, agent, admin.
 */
import { getTranslations } from "next-intl/server";

import { DashboardAdmin } from "@/components/dashboard/DashboardAdmin";
import { DashboardAgent } from "@/components/dashboard/DashboardAgent";
import { DashboardCustomer } from "@/components/dashboard/DashboardCustomer";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireCurrentUser } from "@/lib/auth/server-session";
import { DashboardService } from "@/services/dashboard/dashboard-service";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

/** Kontrolni panel (serverska komponenta). */
export default async function DashboardPage() {
  const { ctx, profile } = await requireCurrentUser();
  const t = await getTranslations("dashboard");

  // Korak 1: podaci po ulozi prijavljenog korisnika.
  const data = await new DashboardService(ctx).getForCurrentUser();

  // Korak 2: opis ispod pozdrava, po ulozi.
  const description = {
    customer: t("descriptionCustomer"),
    agent: t("descriptionAgent"),
    admin: t("descriptionAdmin"),
  }[data.kind];

  return (
    <>
      <PageHeader title={t("welcome", { name: profile.fullName })} description={description} />
      {/* Korak 3: prikaz za ulogu (polje kind kaže koji je oblik podataka). */}
      {data.kind === "customer" ? <DashboardCustomer data={data} /> : null}
      {data.kind === "agent" ? <DashboardAgent data={data} /> : null}
      {data.kind === "admin" ? <DashboardAdmin data={data} /> : null}
    </>
  );
}
