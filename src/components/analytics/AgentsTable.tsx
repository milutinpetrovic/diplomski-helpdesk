/**
 * Fajl: src/components/analytics/AgentsTable.tsx
 * Svrha: tabela učinka tima u periodu (FZ-14, FZ-16): za svakog agenta (i
 * admina) broj dodeljenih i rešenih zahteva, prosečno vreme rešavanja i
 * prosečna ocena. Klik na naslov kolone sortira tabelu (ponovni klik menja
 * smer); sortirana kolona ima aria-sort za čitač ekrana. Na telefonu se
 * tabela pomera vodoravno.
 * Koristi ga: stranica /analytics. Klijentska komponenta (sortiranje).
 * Povezano sa: AnalyticsService.agents (oblik AgentStats), analytics-format.ts.
 */
"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import {
  formatDuration,
  formatRating,
  type AnalyticsTranslator,
} from "@/components/analytics/analytics-format";
import type { AgentStats } from "@/lib/validation/analytics";

/** Kolone po kojima se sortira. */
type SortKey =
  "fullName" | "assignedCount" | "resolvedCount" | "avgResolutionMinutes" | "avgRating";

/** Ključ prevoda za naslov svake kolone (analytics.agents.<ključ>). */
const COLUMN_LABELS: Record<SortKey, string> = {
  fullName: "member",
  assignedCount: "assigned",
  resolvedCount: "resolved",
  avgResolutionMinutes: "avgResolution",
  avgRating: "avgRating",
};

/**
 * Sortira agente po koloni. Prazne vrednosti (null) uvek idu na kraj.
 * Ulaz: spisak, kolona i smer. Vraća: novi niz (ulaz se ne menja).
 */
export function sortAgents(agents: AgentStats[], key: SortKey, ascending: boolean): AgentStats[] {
  return [...agents].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const order =
      typeof left === "string" ? left.localeCompare(String(right)) : left - (right as number);
    return ascending ? order : -order;
  });
}

/** Tabela učinka. Ulaz: učinak po agentu (najviše rešenih prvo). */
export function AgentsTable({ agents }: { agents: AgentStats[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const translate = useTranslations("analytics") as unknown as AnalyticsTranslator;
  // Podrazumevano kao sa servera: najviše rešenih prvo.
  const [sortKey, setSortKey] = useState<SortKey>("resolvedCount");
  const [ascending, setAscending] = useState(false);

  if (agents.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("analytics.agents.empty")}</p>;
  }

  /** Klik na kolonu: ista kolona menja smer, nova počinje od najvećeg (ime od A). */
  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setAscending(!ascending);
    } else {
      setSortKey(key);
      setAscending(key === "fullName");
    }
  }

  const rows = sortAgents(agents, sortKey, ascending);
  const number = new Intl.NumberFormat(locale);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b">
            {(Object.keys(COLUMN_LABELS) as SortKey[]).map((key) => {
              const label = t(`analytics.agents.${COLUMN_LABELS[key]}`);
              const active = key === sortKey;
              return (
                <th
                  key={key}
                  scope="col"
                  aria-sort={active ? (ascending ? "ascending" : "descending") : undefined}
                  className={key === "fullName" ? "py-2 pr-3 text-left" : "px-3 py-2 text-right"}
                >
                  {/* Dugme u naslovu: radi i tastaturom. */}
                  <button
                    type="button"
                    onClick={() => sortBy(key)}
                    aria-label={t("analytics.agents.sortBy", { column: label })}
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    {label}
                    {active ? (
                      ascending ? (
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="size-3.5" aria-hidden="true" />
                      )
                    ) : null}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((agent) => (
            <tr key={agent.agentId} className="border-b last:border-0">
              {/* Ime, uloga i oznaka neaktivnog naloga. */}
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                <span className="font-medium">{agent.fullName}</span>
                <span className="block text-xs text-muted-foreground">
                  {t(`roles.${agent.role}`)}
                  {agent.isActive ? null : ` · ${t("analytics.agents.inactive")}`}
                </span>
              </th>
              <td className="px-3 py-2 text-right tabular-nums">
                {number.format(agent.assignedCount)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {number.format(agent.resolvedCount)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatDuration(translate, agent.avgResolutionMinutes)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatRating(translate, locale, agent.avgRating)}
                {agent.ratingCount > 0 ? (
                  <span className="block text-xs text-muted-foreground">
                    {t("analytics.agents.ratingCount", { count: agent.ratingCount })}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">{t("analytics.agents.note")}</p>
    </div>
  );
}
