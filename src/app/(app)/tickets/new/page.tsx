/**
 * Fajl: src/app/(app)/tickets/new/page.tsx
 * Svrha: stranica /tickets/new — prijava novog zahteva (UC-09).
 * Pristup: samo customer. Agent i admin vide poruku „Nemate pristup“ sa
 * linkom na listu zahteva (isto pravilo važi i u API-ju: POST /api/tickets).
 * Povezano sa: NewTicketForm (forma), CategoryService (aktivne kategorije za izbor).
 */
import { getTranslations } from "next-intl/server";

import { Forbidden } from "@/components/layout/Forbidden";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewTicketForm } from "@/components/tickets/NewTicketForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/auth/server-session";
import { CategoryService } from "@/services/categories/category-service";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("tickets.new");
  return { title: t("title") };
}

/** Stranica sa formom za novi zahtev (serverska komponenta; forma je klijentska). */
export default async function NewTicketPage() {
  // Korak 1: provera uloge na serveru (RBAC).
  const user = await requirePageRole(["customer"]);
  const t = await getTranslations();
  if (!user) {
    return (
      <Forbidden
        text={t("forbidden.customerOnly")}
        backHref="/tickets"
        backLabel={t("forbidden.toTickets")}
      />
    );
  }

  // Korak 2: aktivne kategorije za padajuću listu.
  const categories = await new CategoryService(user.ctx).listActive();

  return (
    <>
      <PageHeader title={t("tickets.new.title")} description={t("tickets.new.description")} />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            <h2>{t("tickets.new.cardTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <NewTicketForm categories={categories} />
        </CardContent>
      </Card>
    </>
  );
}
