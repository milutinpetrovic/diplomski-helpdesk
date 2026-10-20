/**
 * Fajl: src/app/(app)/analytics/page.tsx
 * Svrha: stranica /analytics — analitika rada tima (UC-23). Grafikoni stižu u Fazi 8.
 * Pristup: admin (proverava analytics/layout.tsx).
 */
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/ComingSoon";
import { PageHeader } from "@/components/layout/PageHeader";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("analytics") };
}

/** Analitika (privremeni prikaz). */
export default async function AnalyticsPage() {
  const t = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("analytics")} />
      <ComingSoon />
    </>
  );
}
