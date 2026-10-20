/**
 * Fajl: src/app/(app)/tickets/[id]/not-found.tsx
 * Svrha: prikaz „Zahtev nije pronađen“ kada stranica /tickets/[id] pozove
 * notFound(): zahtev ne postoji, ID u adresi nije ispravan, ili korisnik
 * nema pristup zahtevu (tuđi zahtev se ne razlikuje od nepostojećeg).
 * Prikazuje se unutar rasporeda aplikacije (meni ostaje vidljiv).
 */
import Link from "next/link";
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

/** Poruka sa linkom nazad na listu zahteva (serverska komponenta). */
export default async function TicketNotFound() {
  const t = await getTranslations("tickets.detail");
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <SearchX className="size-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">{t("notFoundTitle")}</h1>
      <p className="max-w-md text-muted-foreground">{t("notFoundText")}</p>
      <Button asChild variant="outline">
        <Link href="/tickets">{t("back")}</Link>
      </Button>
    </div>
  );
}
