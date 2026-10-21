/**
 * Fajl: src/components/dashboard/StatCard.tsx
 * Svrha: kartica sa jednim brojem na kontrolnom panelu (npr. „Hitni: 2“).
 * Cela kartica je link na listu zahteva sa odgovarajućim filterom, pa se
 * uvek može videti šta stoji iza broja.
 * Koriste ga: DashboardCustomer, DashboardAgent, DashboardAdmin, StatusCountGrid.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Kartica sa brojem.
 * Ulaz: prevedeni naziv, broj, link (lista sa filterom) i opciona boja
 * (Tailwind klase, npr. iz STATUS_BADGE_CLASSES) za isticanje.
 */
export function StatCard({
  label,
  value,
  href,
  className,
}: {
  label: string;
  value: number | string;
  href: string;
  className?: string;
}) {
  const t = useTranslations("dashboard");
  return (
    <Link
      href={href}
      // Čitač ekrana čuje i šta link otvara, ne samo broj.
      aria-label={`${label}: ${value}. ${t("showList", { label })}`}
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-muted/40",
        className,
      )}
    >
      <span className="text-sm">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value}</span>
    </Link>
  );
}
