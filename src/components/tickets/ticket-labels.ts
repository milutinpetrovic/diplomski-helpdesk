/**
 * Fajl: src/components/tickets/ticket-labels.ts
 * Svrha: pravila prikaza zahteva na jednom mestu (bez JSX-a, lako za testiranje):
 *   - boje oznaka za status i prioritet (Tailwind klase)
 *   - naziv kategorije na izabranom jeziku
 *   - naziv dugmeta za svaki prelaz statusa (npr. resolved -> closed je za
 *     korisnika „Potvrdi rešenje“, a za tim podrške „Zatvori zahtev“)
 *   - ključevi prevoda za sortiranje liste
 * Koriste ga: TicketBadges, TicketList, TicketFilters, TicketActions, TicketHistory.
 * Povezano sa: messages/*.json (sekcije ticketStatus, ticketPriority, tickets),
 * StatusTransitionPolicy (koji prelazi postoje), docs/02, sekcija 4.
 */
import type { Category } from "@/lib/validation/categories";
import type { TicketSort } from "@/lib/validation/tickets";
import type { TicketPriority, TicketStatus } from "@/types/domain";

/**
 * Boja oznake statusa. Svaka boja ima i tekst (naziv statusa), pa se status
 * ne prepoznaje samo po boji (pristupačnost, NFZ-4).
 */
export const STATUS_BADGE_CLASSES: Record<TicketStatus, string> = {
  open: "border-sky-600/30 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  in_progress:
    "border-violet-600/30 bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  waiting_on_customer:
    "border-amber-600/30 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  resolved:
    "border-emerald-600/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  closed: "border-zinc-500/30 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/** Boja oznake prioriteta: od sive (nizak) do crvene (hitan). */
export const PRIORITY_BADGE_CLASSES: Record<TicketPriority, string> = {
  low: "border-zinc-500/30 bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  medium: "border-blue-600/30 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  high: "border-orange-600/30 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  urgent: "border-red-600/40 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
};

/**
 * Naziv kategorije na jeziku interfejsa.
 * Ulaz: kategorija (ili null) i jezik iz next-intl ("sr" ili "en"; za svaki
 * drugi jezik engleski naziv). Vraća: naziv, ili null ako kategorije nema.
 */
export function categoryName(category: Category | null, locale: string): string | null {
  if (!category) return null;
  return locale === "sr" ? category.nameSr : category.nameEn;
}

/** Ključ prevoda za dugme prelaza (messages/*.json -> tickets.transitions.<ključ>). */
export type TransitionLabelKey =
  "startWork" | "waitOnCustomer" | "resume" | "resolve" | "close" | "cancel" | "confirm" | "reopen";

/**
 * Naziv dugmeta za prelaz statusa, prilagođen ulozi.
 * Ulaz: trenutni i novi status i da li je prijavljeni korisnik (customer).
 * Vraća: ključ prevoda. Isti prelaz ima drugo značenje za korisnika:
 *   - open -> closed: korisnik „otkazuje“ svoj zahtev, admin ga „zatvara“
 *   - resolved -> closed: korisnik „potvrđuje rešenje“, tim „zatvara“
 */
export function transitionLabelKey(
  from: TicketStatus,
  to: TicketStatus,
  isCustomer: boolean,
): TransitionLabelKey {
  switch (to) {
    case "closed":
      if (isCustomer) return from === "open" ? "cancel" : "confirm";
      return "close";
    case "waiting_on_customer":
      return "waitOnCustomer";
    case "resolved":
      return "resolve";
    case "open":
      return "reopen";
    case "in_progress":
      // Iz „Rešen“ nazad u obradu je ponovno otvaranje; iz „Čeka korisnika“ nastavak rada.
      if (from === "resolved") return "reopen";
      if (from === "waiting_on_customer") return "resume";
      return "startWork";
  }
}

/** Sortiranje -> ključ prevoda (messages/*.json -> tickets.sort.<ključ>). */
export const SORT_LABEL_KEYS: Record<TicketSort, string> = {
  "-createdAt": "newest",
  createdAt: "oldest",
  "-updatedAt": "recentlyUpdated",
  updatedAt: "leastRecentlyUpdated",
  "-priority": "priorityDesc",
  priority: "priorityAsc",
};
