/**
 * Fajl: src/components/dashboard/DashboardAdmin.tsx
 * Svrha: kontrolni panel administratora (UC-25):
 *   - ukupno otvorenih (nerešenih), nedodeljenih i hitnih zahteva
 *   - svi zahtevi po statusu
 *   - opterećenje tima: koliko nerešenih zahteva ima svaki agent/admin
 *   - najstariji nedodeljeni zahtevi i link na analitiku
 * Koristi ga: stranica /dashboard. Serverska komponenta.
 * Povezano sa: DashboardService (oblik AdminDashboard), UserAdminService.listAgents.
 */
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { useTranslations } from "next-intl";

import { StatCard } from "@/components/dashboard/StatCard";
import { StatusCountGrid } from "@/components/dashboard/StatusCountGrid";
import { TicketMiniList } from "@/components/dashboard/TicketMiniList";
import { ticketListHref } from "@/components/tickets/list-params";
import { PRIORITY_BADGE_CLASSES } from "@/components/tickets/ticket-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminDashboard } from "@/lib/validation/dashboard";

/** Panel administratora. Ulaz: podaci iz DashboardService. */
export function DashboardAdmin({ data }: { data: AdminDashboard }) {
  const t = useTranslations();
  // Najveće opterećenje u timu, za širinu trake (1 da se ne deli nulom).
  const maxLoad = Math.max(1, ...data.workload.map((member) => member.openAssignedCount));

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="outline" className="self-start">
        <Link href="/analytics">
          <ChartColumn aria-hidden="true" />
          {t("dashboard.analyticsLink")}
        </Link>
      </Button>

      {/* Glavni brojevi. Telefon: jedna ispod druge u dve kolone; računar: tri u redu. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label={t("dashboard.open")}
          value={data.openCount}
          href={ticketListHref({ status: "unresolved" })}
        />
        <StatCard
          label={t("dashboard.unassigned")}
          value={data.unassignedCount}
          href={ticketListHref({
            status: "unresolved",
            assigneeId: "unassigned",
            sort: "createdAt",
          })}
        />
        <StatCard
          label={t("dashboard.urgent")}
          value={data.urgentCount}
          href={ticketListHref({ status: "unresolved", priority: "urgent" })}
          className={data.urgentCount > 0 ? PRIORITY_BADGE_CLASSES.urgent : undefined}
        />
      </div>

      <StatusCountGrid title={t("dashboard.allTickets")} counts={data.statusCounts} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Opterećenje tima: ime, uloga, broj i traka srazmerna broju. */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("dashboard.workload")}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.workload.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.workloadEmpty")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{t("dashboard.workloadMember")}</th>
                    <th scope="col">{t("dashboard.workloadOpen")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workload.map((member) => (
                    <tr key={member.id}>
                      <td className="py-1.5 pr-3">
                        <Link
                          href={ticketListHref({ status: "unresolved", assigneeId: member.id })}
                          className="font-medium hover:underline"
                        >
                          {member.fullName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {t(`roles.${member.role}`)}
                        </span>
                      </td>
                      <td className="w-1/2 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${(member.openAssignedCount / maxLoad) * 100}%` }}
                            />
                          </div>
                          <span className="w-6 text-right tabular-nums">
                            {member.openAssignedCount}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <TicketMiniList
          title={t("dashboard.queue")}
          tickets={data.unassignedQueue}
          emptyText={t("dashboard.queueEmpty")}
          showCreatedAt
          moreHref={ticketListHref({
            status: "unresolved",
            assigneeId: "unassigned",
            sort: "createdAt",
          })}
          moreLabel={t("dashboard.allLink")}
        />
      </div>
    </div>
  );
}
