/**
 * Fajl: src/app/(app)/dashboard/page.tsx
 * Svrha: stranica /dashboard — kontrolni panel (UC-25). Za sada samo pozdrav;
 * pravi sadržaj po ulozi (zahtevi po statusu, red rada, pregled svih) stiže u Fazi 6.
 * Ovde se korisnik vodi posle prijave.
 * Pristup: customer, agent, admin.
 */
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/ComingSoon";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireCurrentUser } from "@/lib/auth/server-session";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

/** Kontrolni panel (privremeni prikaz). */
export default async function DashboardPage() {
  const { profile } = await requireCurrentUser();
  const t = await getTranslations("dashboard");

  return (
    <>
      <PageHeader title={t("title")} description={t("welcome", { name: profile.fullName })} />
      <ComingSoon />
    </>
  );
}
