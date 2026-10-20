/**
 * Fajl: src/components/layout/Forbidden.tsx
 * Svrha: poruka „Nemate pristup“ kada prijavljeni korisnik otvori stranicu
 * koja nije za njegovu ulogu (npr. korisnik ili agent otvori /admin/users).
 * Koriste ga: layout.tsx za /admin i /analytics (provera uloge na serveru, RBAC).
 */
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/** Poruka o zabranjenom pristupu sa linkom nazad (serverska komponenta). */
export async function Forbidden() {
  const t = await getTranslations("forbidden");
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <ShieldX className="size-12 text-destructive" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="max-w-md text-muted-foreground">{t("text")}</p>
      <Button asChild variant="outline">
        <Link href="/dashboard">{t("back")}</Link>
      </Button>
    </div>
  );
}
