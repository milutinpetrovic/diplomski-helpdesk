/**
 * Fajl: src/components/layout/Forbidden.tsx
 * Svrha: poruka „Nemate pristup“ kada prijavljeni korisnik otvori stranicu
 * koja nije za njegovu ulogu (npr. korisnik ili agent otvori /admin/users,
 * ili agent otvori /tickets/new).
 * Koriste ga: layout.tsx za /admin i /analytics, stranica /tickets/new
 * (provera uloge na serveru, RBAC).
 */
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/**
 * Poruka o zabranjenom pristupu sa linkom nazad (serverska komponenta).
 * Ulaz (sve opciono): prevedeni tekst objašnjenja i link nazad; podrazumevano
 * „samo za administratore“ i povratak na kontrolni panel.
 */
export async function Forbidden({
  text,
  backHref = "/dashboard",
  backLabel,
}: {
  text?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const t = await getTranslations("forbidden");
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <ShieldX className="size-12 text-destructive" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="max-w-md text-muted-foreground">{text ?? t("text")}</p>
      <Button asChild variant="outline">
        <Link href={backHref}>{backLabel ?? t("back")}</Link>
      </Button>
    </div>
  );
}
