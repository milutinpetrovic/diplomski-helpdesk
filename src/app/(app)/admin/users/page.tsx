/**
 * Fajl: src/app/(app)/admin/users/page.tsx
 * Svrha: stranica /admin/users — upravljanje korisnicima i ulogama (UC-21).
 * Tabela korisnika stiže u Fazi 8.
 * Pristup: admin (proverava admin/layout.tsx).
 */
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/ComingSoon";
import { PageHeader } from "@/components/layout/PageHeader";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("users") };
}

/** Korisnici (privremeni prikaz). */
export default async function AdminUsersPage() {
  const t = await getTranslations("nav");
  return (
    <>
      <PageHeader title={t("users")} />
      <ComingSoon />
    </>
  );
}
