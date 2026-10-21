/**
 * Fajl: src/components/layout/ComingSoon.tsx
 * Svrha: privremeni sadržaj stranica koje postoje u meniju, a prave se u
 * kasnijim fazama (analitika i administracija — Faza 8).
 * Postoje već sada da bi se mogla proveriti zaštita stranica i meni po ulozi.
 */
import { Construction } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";

/** Kartica sa porukom „u izradi“ (serverska komponenta). */
export async function ComingSoon() {
  const t = await getTranslations("placeholder");
  return (
    <Card>
      <CardContent className="flex items-center gap-3 text-muted-foreground">
        <Construction className="size-5 shrink-0" aria-hidden="true" />
        <p>{t("text")}</p>
      </CardContent>
    </Card>
  );
}
