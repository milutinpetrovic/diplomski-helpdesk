/**
 * Fajl: src/components/dashboard/DashboardAgent.tsx
 * Svrha: kontrolni panel agenta (UC-25) — njegov red rada:
 *   - brojevi: nedodeljeni, hitni (njegovi i nedodeljeni), njegovi rešeni, prosečna ocena
 *   - njegovi dodeljeni zahtevi po statusu
 *   - red čekanja (najstariji nedodeljeni) i hitni zahtevi
 * Koristi ga: stranica /dashboard. Serverska komponenta.
 * Povezano sa: DashboardService (oblik AgentDashboard).
 */
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatusCountGrid } from "@/components/dashboard/StatusCountGrid";
import { TicketMiniList } from "@/components/dashboard/TicketMiniList";
import { ticketListHref } from "@/components/tickets/list-params";
import { PRIORITY_BADGE_CLASSES } from "@/components/tickets/ticket-labels";
import type { AgentDashboard } from "@/lib/validation/dashboard";

/** Panel agenta. Ulaz: podaci iz DashboardService. */
export function DashboardAgent({ data }: { data: AgentDashboard }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-col gap-6">
      {/* Glavni brojevi: telefon dve kolone, računar četiri. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("unassigned")}
          value={data.unassignedCount}
          href={ticketListHref({
            status: "unresolved",
            assigneeId: "unassigned",
            sort: "createdAt",
          })}
        />
        <StatCard
          label={t("urgent")}
          value={data.urgentCount}
          href={ticketListHref({ status: "unresolved", priority: "urgent" })}
          className={data.urgentCount > 0 ? PRIORITY_BADGE_CLASSES.urgent : undefined}
        />
        <StatCard
          label={t("resolvedByMe")}
          value={data.resolvedCount}
          // Broj obuhvata rešene i zatvorene; link vodi na sve agentove zahteve.
          href={ticketListHref({ assigneeId: "me" })}
        />
        {/* Ocena nije link (nema listu iza sebe), pa je obična kartica. */}
        <div className="flex flex-col gap-1 rounded-lg border p-4">
          <span className="text-sm">{t("myRating")}</span>
          {data.rating.average === null ? (
            <span className="text-sm text-muted-foreground">{t("ratingNone")}</span>
          ) : (
            <span className="flex items-center gap-1 text-3xl font-semibold tabular-nums">
              {data.rating.average.toFixed(1)}
              <Star className="size-6 fill-amber-400 text-amber-500" aria-hidden="true" />
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {t("ratingCount", { count: data.rating.count })}
          </span>
        </div>
      </div>

      <StatusCountGrid
        title={t("assignedToMe")}
        counts={data.myStatusCounts}
        filter={{ assigneeId: "me" }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TicketMiniList
          title={t("queue")}
          tickets={data.unassignedQueue}
          emptyText={t("queueEmpty")}
          showCreatedAt
          moreHref={ticketListHref({
            status: "unresolved",
            assigneeId: "unassigned",
            sort: "createdAt",
          })}
          moreLabel={t("allLink")}
        />
        <TicketMiniList
          title={t("urgentList")}
          tickets={data.urgent}
          emptyText={t("urgentEmpty")}
          showCreatedAt
        />
      </div>
    </div>
  );
}
