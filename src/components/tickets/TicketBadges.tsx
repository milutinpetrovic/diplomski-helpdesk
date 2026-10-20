/**
 * Fajl: src/components/tickets/TicketBadges.tsx
 * Svrha: obojene oznake za status i prioritet zahteva, sa prevedenim nazivom
 * (npr. „U obradi“, „Hitan“). Boje su u ticket-labels.ts.
 * Koriste ga: lista zahteva (tabela i kartice) i zaglavlje stranice zahteva.
 * Radi i u serverskim i u klijentskim komponentama (useTranslations iz next-intl).
 */
import { useTranslations } from "next-intl";

import { PRIORITY_BADGE_CLASSES, STATUS_BADGE_CLASSES } from "@/components/tickets/ticket-labels";
import { cn } from "@/lib/utils";
import type { TicketPriority, TicketStatus } from "@/types/domain";

/** Zajednički izgled oznake. */
const BADGE_BASE =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** Oznaka statusa. Ulaz: status zahteva. */
export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const t = useTranslations("ticketStatus");
  return <span className={cn(BADGE_BASE, STATUS_BADGE_CLASSES[status])}>{t(status)}</span>;
}

/** Oznaka prioriteta. Ulaz: prioritet zahteva. */
export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const t = useTranslations("ticketPriority");
  return <span className={cn(BADGE_BASE, PRIORITY_BADGE_CLASSES[priority])}>{t(priority)}</span>;
}
