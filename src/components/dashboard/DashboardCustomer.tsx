/**
 * Fajl: src/components/dashboard/DashboardCustomer.tsx
 * Svrha: kontrolni panel korisnika (UC-25):
 *   - broj njegovih zahteva po statusu (kartice vode na filtriranu listu)
 *   - „Čeka vaš odgovor“: zahtevi u kojima tim traži informacije od njega
 *   - „Ocenite rešenje“: rešeni zahtevi bez ocene (CSAT)
 *   - poslednjih 5 zahteva i dugme „Novi zahtev“
 * Koristi ga: stranica /dashboard. Serverska komponenta.
 * Povezano sa: DashboardService (oblik CustomerDashboard).
 */
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatusCountGrid } from "@/components/dashboard/StatusCountGrid";
import { TicketMiniList } from "@/components/dashboard/TicketMiniList";
import { Button } from "@/components/ui/button";
import type { CustomerDashboard } from "@/lib/validation/dashboard";

/** Panel korisnika. Ulaz: podaci iz DashboardService. */
export function DashboardCustomer({ data }: { data: CustomerDashboard }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-col gap-6">
      <Button asChild className="self-start">
        <Link href="/tickets/new">
          <Plus aria-hidden="true" />
          {t("newTicket")}
        </Link>
      </Button>

      <StatusCountGrid title={t("myTickets")} counts={data.statusCounts} />

      {/* Ono što čeka korisnika je važnije od pregleda, pa ide prvo. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TicketMiniList
          title={t("waitingOnMe")}
          tickets={data.waitingOnMe}
          emptyText={t("waitingOnMeEmpty")}
          showStatus={false}
        />
        <TicketMiniList title={t("toRate")} tickets={data.toRate} emptyText={t("toRateEmpty")} />
      </div>

      <TicketMiniList
        title={t("recent")}
        tickets={data.recent}
        emptyText={t("recentEmpty")}
        moreHref="/tickets"
        moreLabel={t("allLink")}
      />
    </div>
  );
}
