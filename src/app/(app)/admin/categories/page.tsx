/**
 * Fajl: src/app/(app)/admin/categories/page.tsx
 * Svrha: stranica /admin/categories — upravljanje kategorijama (UC-22).
 * Tabela kategorija stiže u Fazi 8.
 * Pristup: admin (proverava admin/layout.tsx).
 */
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/ComingSoon";
import { PageHeader } from "@/components/layout/PageHeader";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("categories") };
}

/** Kategorije (privremeni prikaz). */
export default async function AdminCategoriesPage() {
  const t = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("categories")} />
      <ComingSoon />
    </>
  );
}
