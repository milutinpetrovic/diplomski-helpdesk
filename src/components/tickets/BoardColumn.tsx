/**
 * Fajl: src/components/tickets/BoardColumn.tsx
 * Svrha: jedna kolona kanban table (jedan status zahteva):
 *   - zaglavlje sa nazivom statusa i ukupnim brojem zahteva u tom statusu
 *   - kartice (najviše BOARD_COLUMN_LIMIT) i link „Prikaži sve (N)“ ka listi
 *     filtriranoj po ovom statusu kad zahteva ima više
 *   - mesto za spuštanje kartice (useDroppable); dok traje prevlačenje kolona
 *     je istaknuta ako se kartica sme spustiti u nju, a zatamnjena sa oznakom
 *     „Nije dozvoljeno“ ako ne sme
 * Koristi ga: TicketBoard. Klijentska komponenta.
 * Povezano sa: BoardCard, board-rules.ts, @dnd-kit/core (useDroppable).
 */
"use client";

import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import { Ban } from "lucide-react";
import { useTranslations } from "next-intl";

import { BoardCard } from "@/components/tickets/BoardCard";
import { cn } from "@/lib/utils";
import type { TicketListItem } from "@/lib/validation/tickets";
import type { TicketStatus } from "@/types/domain";

/**
 * Stanje kolone dok traje prevlačenje:
 *   idle = niko ne prevlači, source = kolona iz koje je kartica krenula,
 *   allowed = sme se spustiti, blocked = ne sme.
 */
export type BoardColumnState = "idle" | "source" | "allowed" | "blocked";

/**
 * Kolona table.
 * Ulaz: status, kartice, ukupan broj u statusu, link ka listi, stanje kolone,
 * da li se kartica može prevući (po zahtevu), da li se vidi podnosilac i
 * provera klika posle prevlačenja (prosleđuje se karticama).
 */
export function BoardColumn({
  status,
  items,
  total,
  showAllHref,
  state,
  canDrag,
  showCreator,
  shouldIgnoreClick,
}: {
  status: TicketStatus;
  items: TicketListItem[];
  total: number;
  showAllHref: string;
  state: BoardColumnState;
  canDrag: (ticket: TicketListItem) => boolean;
  showCreator: boolean;
  shouldIgnoreClick: () => boolean;
}) {
  const t = useTranslations();
  // Korak 1: kolona je mesto za spuštanje; ID je status (TicketBoard ga čita pri spuštanju).
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const headingId = `board-column-${status}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        "relative flex w-[17rem] shrink-0 snap-start flex-col gap-2 rounded-xl border bg-muted/40 p-2 transition xl:w-auto xl:min-w-0 xl:flex-1",
        // Korak 2: izgled po stanju prevlačenja.
        state === "allowed" && "border-primary/60 bg-primary/5",
        state === "allowed" && isOver && "ring-2 ring-primary",
        state === "blocked" && "opacity-50",
      )}
    >
      {/* Zaglavlje: naziv statusa i ukupan broj. */}
      <h2
        id={headingId}
        className="flex items-center justify-between gap-2 px-1 pt-1 text-sm font-semibold"
      >
        <span>{t(`ticketStatus.${status}`)}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {total}
        </span>
      </h2>

      {/* Oznaka za kolonu u koju se kartica ne sme spustiti. */}
      {state === "blocked" ? (
        <p className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
          <Ban className="size-3.5" aria-hidden="true" />
          {t("tickets.board.notAllowedHere")}
        </p>
      ) : null}

      {/* Kartice; prazna kolona i dalje prima karticu (min. visina). */}
      {items.length > 0 ? (
        <ul className="flex min-h-24 flex-col gap-2">
          {items.map((ticket) => (
            <li key={ticket.id}>
              <BoardCard
                ticket={ticket}
                canDrag={canDrag(ticket)}
                showCreator={showCreator}
                shouldIgnoreClick={shouldIgnoreClick}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex min-h-24 items-center justify-center rounded-lg border border-dashed px-2 text-center text-xs text-muted-foreground">
          {t("tickets.board.emptyColumn")}
        </p>
      )}

      {/* Ostatak kolone je na listi filtriranoj po statusu. */}
      {total > items.length ? (
        <Link
          href={showAllHref}
          className="px-1 pb-1 text-sm font-medium text-primary hover:underline"
        >
          {t("tickets.board.showAll", { total })}
        </Link>
      ) : null}
    </section>
  );
}
