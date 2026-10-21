/**
 * Fajl: src/components/tickets/TicketBoard.tsx
 * Svrha: kanban tabla zahteva (/tickets?view=board, UC-13, UC-16, UC-17):
 *   - pet kolona, po jedna za svaki status (BoardColumn)
 *   - prevlačenjem kartice u drugu kolonu menja se status zahteva
 *     (POST /api/tickets/{id}/status); agent prevlačenjem nedodeljenog
 *     otvorenog zahteva u „U obradi“ preuzima zahtev (POST /api/tickets/{id}/assign)
 *   - dozvoljene kolone daje boardDropTargets (ista tabela prelaza kao dugmad
 *     na stranici zahteva); API i baza iste provere rade ponovo
 *   - kartica se odmah premesti; ako API odbije, vraća se nazad uz prevedenu
 *     poruku (useApiAction), a otkazivanje (korisnik: otvoren -> zatvoren)
 *     prvo traži potvrdu u dijalogu
 *   - miš, dugi pritisak prstom (telefon) i tastatura (Space, strelice levo/desno,
 *     Space, Escape), uz najave za čitač ekrana na srpskom i engleskom
 * Osvežavanje uživo dolazi od postojećeg real-time sloja (router.refresh), a
 * tabla tada odbacuje svoja privremena premeštanja i prikazuje stanje sa servera.
 * Koristi ga: stranica /tickets. Klijentska komponenta. Uloge: customer, agent, admin.
 * Povezano sa: board-rules.ts, BoardColumn, BoardCard, @dnd-kit/core, useApiAction.
 */
"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { BoardCardContent, boardCardClass } from "@/components/tickets/BoardCard";
import { BoardColumn, type BoardColumnState } from "@/components/tickets/BoardColumn";
import {
  applyBoardMoves,
  boardDropTargets,
  needsDropConfirmation,
  type BoardColumnData,
  type BoardDropAction,
  type BoardUser,
} from "@/components/tickets/board-rules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiAction } from "@/hooks/use-api-action";
import { cn } from "@/lib/utils";
import type { TicketListItem } from "@/lib/validation/tickets";
import { TICKET_STATUSES, type TicketStatus } from "@/types/domain";

/** Premeštanje koje čeka potvrdu u dijalogu (otkazivanje zahteva). */
interface PendingDrop {
  ticket: TicketListItem;
  to: TicketStatus;
  action: BoardDropAction;
}

/** Tasteri za prevlačenje tastaturom: Space podiže i spušta (Enter ostaje „otvori zahtev“). */
const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space"] };

/**
 * Pomeranje kartice tastaturom: strelica levo/desno skače u susednu kolonu
 * (umesto podrazumevanih 25 px), pa svaki pritisak znači „jedna kolona“.
 * Ulaz: događaj tastature i stanje dnd-kit (mesto kartice i kolona).
 * Vraća: novi gornji levi ugao kartice, ili ništa za ostale tastere.
 */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  const { collisionRect, droppableRects } = context;
  if (step === 0 || !collisionRect) return undefined;
  event.preventDefault();

  // Korak 1: kolone sleva nadesno i kolona u kojoj je kartica sada (po sredini kartice).
  const rects = [...droppableRects.values()].sort((a, b) => a.left - b.left);
  const center = collisionRect.left + collisionRect.width / 2;
  const current = rects.findIndex((rect) => center >= rect.left && center <= rect.right);
  const target = rects[Math.min(rects.length - 1, Math.max(0, current + step))];
  if (!target) return undefined;

  // Korak 2: kartica ide na vrh susedne kolone.
  return { x: target.left + 8, y: target.top + 40 };
};

/**
 * Kanban tabla.
 * Ulaz: kolone sa servera, prijavljeni korisnik (ID i uloga) i da li se na
 * karticama vidi podnosilac (tim podrške).
 */
export function TicketBoard({
  columns,
  user,
  showCreator,
}: {
  columns: BoardColumnData[];
  user: BoardUser;
  showCreator: boolean;
}) {
  const t = useTranslations();
  const { run } = useApiAction();

  // Privremena premeštanja (ID zahteva -> novi status) dok API ne potvrdi.
  const [moves, setMoves] = useState<Record<string, TicketStatus>>({});
  // Kad stignu novi podaci sa servera (posle izmene ili real-time osvežavanja),
  // privremena premeštanja se brišu: server je tada izvor istine.
  const [serverColumns, setServerColumns] = useState(columns);
  if (serverColumns !== columns) {
    setServerColumns(columns);
    setMoves({});
  }
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [confirming, setConfirming] = useState<PendingDrop | null>(null);
  // Kartica je upravo spuštena: klik koji pregledač tada pošalje ne otvara zahtev.
  const justDropped = useRef(false);

  // Korak 1: kolone kakve korisnik vidi (sa privremenim premeštanjima).
  const shown = applyBoardMoves(columns, moves);
  const tickets = new Map(shown.flatMap((column) => column.items).map((item) => [item.id, item]));
  const active = activeId === null ? undefined : tickets.get(String(activeId));
  const activeTargets = active ? boardDropTargets(active, user) : undefined;

  // Korak 2: senzori — miš (posle pomeraja od 6 px, da klik ostane klik),
  // dodir (posle dugog pritiska, da se ne pomeša sa pomeranjem ekrana) i tastatura.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: KEYBOARD_CODES,
      coordinateGetter: columnKeyboardCoordinates,
    }),
  );

  /** Naziv statusa (kolone) iz ID-ja mesta za spuštanje. */
  const columnName = (id: UniqueIdentifier) => t(`ticketStatus.${String(id) as TicketStatus}`);
  /** Broj zahteva za najave (#1003). */
  const numberOf = (id: UniqueIdentifier) => tickets.get(String(id))?.number ?? "";

  // Korak 3: najave za čitač ekrana (prevedene).
  const announcements: Announcements = {
    onDragStart: ({ active: item }) =>
      t("tickets.board.announce.start", { number: numberOf(item.id) }),
    onDragOver: ({ active: item, over }) =>
      over
        ? t("tickets.board.announce.over", {
            number: numberOf(item.id),
            column: columnName(over.id),
          })
        : t("tickets.board.announce.outside", { number: numberOf(item.id) }),
    onDragEnd: ({ active: item, over }) =>
      over
        ? t("tickets.board.announce.end", {
            number: numberOf(item.id),
            column: columnName(over.id),
          })
        : t("tickets.board.announce.cancel", { number: numberOf(item.id) }),
    onDragCancel: ({ active: item }) =>
      t("tickets.board.announce.cancel", { number: numberOf(item.id) }),
  };

  /** Stanje kolone dok traje prevlačenje (za isticanje i zatamnjivanje). */
  function columnState(status: TicketStatus): BoardColumnState {
    if (!active || !activeTargets) return "idle";
    if (status === active.status) return "source";
    return activeTargets.has(status) ? "allowed" : "blocked";
  }

  /**
   * Slanje premeštanja API-ju: kartica se odmah prikaže u novoj koloni, a ako
   * API odbije, vraća se nazad (poruku greške prikazuje useApiAction).
   */
  async function commit({ ticket, to, action }: PendingDrop) {
    setConfirming(null);
    setMoves((current) => ({ ...current, [ticket.id]: to }));

    const ok =
      action === "claim"
        ? await run(
            (api) => api.post(`/tickets/${ticket.id}/assign`, { assigneeId: user.id }),
            t("tickets.actions.claimed"),
          )
        : await run(
            (api) => api.post(`/tickets/${ticket.id}/status`, { status: to }),
            t("tickets.actions.statusChanged", { status: t(`ticketStatus.${to}`) }),
          );

    if (!ok) {
      setMoves((current) => {
        const rest = { ...current };
        delete rest[ticket.id];
        return rest;
      });
    }
  }

  /** Početak prevlačenja: pamti se koja kartica se vuče. */
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
  }

  /**
   * Spuštanje kartice: provera pravila, pa potvrda (otkazivanje) ili slanje.
   * Spuštanje u istu kolonu ili van table ne radi ništa.
   */
  function handleDragEnd({ active: item, over }: DragEndEvent) {
    setActiveId(null);
    justDropped.current = true;
    setTimeout(() => (justDropped.current = false), 100);
    const ticket = tickets.get(String(item.id));
    const to = over ? (String(over.id) as TicketStatus) : undefined;
    if (!ticket || !to || to === ticket.status || !TICKET_STATUSES.includes(to)) return;

    // Korak 1: da li je prelaz dozvoljen (ista pravila kao dugmad na stranici zahteva).
    const action = boardDropTargets(ticket, user).get(to);
    if (!action) {
      toast.error(
        t("tickets.board.notAllowed", {
          from: t(`ticketStatus.${ticket.status}`),
          to: t(`ticketStatus.${to}`),
        }),
      );
      return;
    }

    // Korak 2: otkazivanje traži potvrdu; ostalo se odmah šalje.
    const drop = { ticket, to, action };
    if (needsDropConfirmation(ticket.status, to, user.role)) setConfirming(drop);
    else void commit(drop);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("tickets.board.instructions") },
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {/* Kolone: na užem ekranu se pomeraju vodoravno (samo tabla, ne cela stranica). */}
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {shown.map((column) => (
            <BoardColumn
              key={column.status}
              status={column.status}
              items={column.items}
              total={column.total}
              showAllHref={column.showAllHref}
              state={columnState(column.status)}
              canDrag={(ticket) => boardDropTargets(ticket, user).size > 0}
              showCreator={showCreator}
              shouldIgnoreClick={() => justDropped.current}
            />
          ))}
        </div>

        {/* Lebdeća kopija kartice koja prati pokazivač (iznad svih kolona). */}
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className={cn(boardCardClass, "w-[16rem] cursor-grabbing shadow-lg")}>
              <BoardCardContent ticket={active} showCreator={showCreator} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Potvrda otkazivanja (korisnik posle ne može sam da vrati zahtev). */}
      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        {confirming ? (
          <DialogContent closeLabel={t("common.closeDialog")}>
            <DialogHeader>
              <DialogTitle>
                {t("tickets.board.cancelTitle", { number: confirming.ticket.number })}
              </DialogTitle>
              <DialogDescription>{t("tickets.actions.cancelConfirm")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(null)}>
                {t("tickets.actions.cancelNo")}
              </Button>
              <Button variant="destructive" onClick={() => void commit(confirming)}>
                {t("tickets.actions.cancelYes")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
