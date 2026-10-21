/**
 * Fajl: src/components/tickets/board-rules.ts
 * Svrha: pravila kanban table zahteva (stranica /tickets?view=board):
 *   - BOARD_COLUMNS: kolone table, po jedna za svaki status, redom toka rada
 *   - boardDropTargets: u koje kolone prijavljeni korisnik sme da prevuče karticu
 *     i šta se tada poziva (promena statusa ili preuzimanje zahteva)
 *   - BOARD_COLUMN_LIMIT: najviše kartica po koloni (ostale su na listi)
 * Pravila prelaza se NE pišu ponovo: koristi se ista tabela kao za dugmad na
 * stranici zahteva (StatusTransitionPolicy, docs/02 sekcija 4). Ovo je samo
 * udobnost interfejsa; API i baza iste provere rade ponovo.
 * Čiste funkcije bez React-a, pa imaju unit test (tests/unit/ticket-board.test.ts).
 * Koristi ga: TicketBoard i stranica /tickets.
 */
import type { TicketListItem } from "@/lib/validation/tickets";
import { StatusTransitionPolicy } from "@/services/policies/status-transitions";
import { TICKET_STATUSES, type TicketStatus, type UserRole } from "@/types/domain";

/** Kolone table: svi statusi, redom toka rada (otvoren -> ... -> zatvoren). */
export const BOARD_COLUMNS: readonly TicketStatus[] = TICKET_STATUSES;

/** Najviše kartica po koloni; ostatak se vidi na listi filtriranoj po statusu. */
export const BOARD_COLUMN_LIMIT = 20;

/**
 * Šta se dešava kad se kartica spusti u kolonu:
 *   - "status": promena statusa (POST /api/tickets/{id}/status)
 *   - "claim": agent preuzima nedodeljen zahtev (POST /api/tickets/{id}/assign),
 *     što zahtev i prebacuje u „U obradi“
 */
export type BoardDropAction = "status" | "claim";

/** Prijavljeni korisnik (ID i uloga). */
export interface BoardUser {
  id: string;
  role: UserRole;
}

/** Deo zahteva iz liste koji je potreban za pravila. */
export type BoardTicket = Pick<TicketListItem, "status" | "creator" | "assignee">;

const policy = new StatusTransitionPolicy();

/**
 * Kolone u koje korisnik sme da spusti karticu zahteva.
 * Ulaz: zahtev iz liste (status, podnosilac, dodeljeni) i prijavljeni korisnik.
 * Vraća: mapu „ciljni status -> akcija“; prazna mapa znači da se kartica ne
 * može prevući (npr. tuđ zahtev za agenta, zatvoren zahtev za korisnika).
 * Uloge: customer, agent, admin (svako dobija svoja pravila).
 */
export function boardDropTargets(
  ticket: BoardTicket,
  user: BoardUser,
): Map<TicketStatus, BoardDropAction> {
  const targets = new Map<TicketStatus, BoardDropAction>();

  // Korak 1: prelazi iz tabele, za odnos korisnika prema zahtevu.
  const actor = {
    role: user.role,
    isOwner: ticket.creator?.id === user.id,
    isAssignee: ticket.assignee?.id === user.id,
  };
  for (const status of policy.allowedTargets(ticket.status, actor)) {
    targets.set(status, "status");
  }

  // Korak 2: agent preuzima nedodeljen otvoren zahtev prevlačenjem u „U obradi“
  // (tabela mu ne dozvoljava direktan prelaz, nego ide kroz dodelu, kao dugme „Preuzmi“).
  if (user.role === "agent" && ticket.status === "open" && !ticket.assignee) {
    targets.set("in_progress", "claim");
  }

  return targets;
}

/**
 * Da li prelaz traži potvrdu pre slanja: korisnik otkazuje svoj otvoren
 * zahtev (open -> closed), kao dugme „Otkaži zahtev“ na stranici zahteva.
 */
export function needsDropConfirmation(
  from: TicketStatus,
  to: TicketStatus,
  role: UserRole,
): boolean {
  return role === "customer" && from === "open" && to === "closed";
}

/** Kolona table kako je stranica učita sa servera. */
export interface BoardColumnData {
  status: TicketStatus;
  /** Najviše BOARD_COLUMN_LIMIT zahteva u ovom statusu (najnoviji prvi). */
  items: TicketListItem[];
  /** Ukupan broj zahteva u ovom statusu (uz iste filtere). */
  total: number;
  /** Adresa liste filtrirane po ovom statusu („Prikaži sve“). */
  showAllHref: string;
}

/**
 * Primena premeštanja koja još nisu stigla sa servera (optimistički prikaz):
 * kartica se odmah vidi u novoj koloni, na vrhu, a brojevi kolona se ispravljaju.
 * Ulaz: kolone sa servera i mapa „ID zahteva -> novi status“.
 * Vraća: nove kolone (ulaz se ne menja).
 */
export function applyBoardMoves(
  columns: readonly BoardColumnData[],
  moves: Readonly<Record<string, TicketStatus>>,
): BoardColumnData[] {
  // Korak 1: premeštene kartice, sa novim statusom.
  const moved: TicketListItem[] = columns
    .flatMap((column) => column.items)
    .flatMap((ticket) => {
      const status = moves[ticket.id];
      return status !== undefined && status !== ticket.status ? [{ ...ticket, status }] : [];
    });

  // Korak 2: svaka kolona gubi kartice koje su otišle i dobija one koje su došle.
  return columns.map((column) => {
    const arrived = moved.filter((ticket) => ticket.status === column.status);
    const kept = column.items.filter((ticket) => !moved.some((m) => m.id === ticket.id));
    const left = column.items.length - kept.length;
    return {
      ...column,
      items: [...arrived, ...kept],
      total: column.total - left + arrived.length,
    };
  });
}
