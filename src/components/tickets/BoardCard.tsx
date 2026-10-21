/**
 * Fajl: src/components/tickets/BoardCard.tsx
 * Svrha: kartica jednog zahteva na kanban tabli (/tickets?view=board):
 *   - broj, naslov, prioritet, kategorija i dodeljeni agent (tim vidi i podnosioca)
 *   - klik (ili Enter) otvara zahtev, kao na listi
 *   - kartica se prevlači mišem, dugim pritiskom prstom ili tastaturom (Space)
 *     ako prijavljeni korisnik sme da je premesti (inače je običan link)
 * BoardCardContent je sam izgled kartice; koristi ga i „lebdeća“ kopija koja
 * prati pokazivač dok traje prevlačenje (DragOverlay u TicketBoard).
 * Koristi ga: BoardColumn i TicketBoard. Klijentska komponenta.
 * Povezano sa: @dnd-kit/core (useDraggable), TicketBadges, ticket-labels.ts.
 */
"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { useLocale, useTranslations } from "next-intl";

import { TicketPriorityBadge } from "@/components/tickets/TicketBadges";
import { categoryName } from "@/components/tickets/ticket-labels";
import { cn } from "@/lib/utils";
import type { TicketListItem } from "@/lib/validation/tickets";

/**
 * Sadržaj kartice (bez prevlačenja i bez linka).
 * Ulaz: zahtev i da li se prikazuje podnosilac (tim podrške).
 */
export function BoardCardContent({
  ticket,
  showCreator,
}: {
  ticket: TicketListItem;
  showCreator: boolean;
}) {
  const t = useTranslations("tickets");
  const locale = useLocale();

  return (
    <>
      {/* Broj i prioritet u prvom redu. */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">#{ticket.number}</span>
        <TicketPriorityBadge priority={ticket.priority} />
      </div>
      <span className="line-clamp-3 text-sm font-medium">{ticket.title}</span>
      {/* Kategorija, (podnosilac) i dodeljeni agent. */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">{t("columns.category")}</dt>
        <dd className="truncate">
          {categoryName(ticket.category, locale) ?? t("list.noCategory")}
        </dd>
        {showCreator ? (
          <>
            <dt className="text-muted-foreground">{t("columns.creator")}</dt>
            <dd className="truncate">{ticket.creator?.fullName ?? "—"}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">{t("columns.assignee")}</dt>
        <dd className="truncate">{ticket.assignee?.fullName ?? t("list.unassigned")}</dd>
      </dl>
    </>
  );
}

/** Zajednički izgled kartice (i na tabli i u lebdećoj kopiji). */
export const boardCardClass =
  "flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-xs";

/**
 * Kartica na tabli: link ka zahtevu koji se može prevući.
 * Ulaz: zahtev, da li korisnik sme da je prevuče (canDrag), da li se vidi
 * podnosilac i funkcija koja kaže da li klik treba zanemariti (klik koji
 * pregledač pošalje odmah posle spuštanja kartice ne sme da otvori zahtev).
 */
export function BoardCard({
  ticket,
  canDrag,
  showCreator,
  shouldIgnoreClick,
}: {
  ticket: TicketListItem;
  canDrag: boolean;
  showCreator: boolean;
  shouldIgnoreClick: () => boolean;
}) {
  const t = useTranslations("tickets.board");
  // Korak 1: veza sa dnd-kit (ID kartice = ID zahteva); bez dozvole prevlačenje je isključeno.
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: ticket.id,
    disabled: !canDrag,
  });

  return (
    <Link
      ref={setNodeRef}
      href={`/tickets/${ticket.id}`}
      {...listeners}
      // Korak 2: od atributa dnd-kit zadržava se samo uputstvo za čitač ekrana
      // (aria-describedby); kartica ostaje link (Enter otvara, Space podiže).
      aria-describedby={canDrag ? attributes["aria-describedby"] : undefined}
      aria-label={t("cardLabel", { number: ticket.number, title: ticket.title })}
      onClick={(event) => {
        if (shouldIgnoreClick()) event.preventDefault();
      }}
      className={cn(
        boardCardClass,
        "transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        // Dugi pritisak na telefonu ne sme da otvori meni za link ni da označi tekst.
        canDrag && "cursor-grab touch-manipulation select-none [-webkit-touch-callout:none]",
        // Original ostaje bled na mestu dok lebdeća kopija prati pokazivač.
        isDragging && "opacity-40",
      )}
    >
      <BoardCardContent ticket={ticket} showCreator={showCreator} />
    </Link>
  );
}
