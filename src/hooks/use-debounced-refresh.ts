/**
 * Fajl: src/hooks/use-debounced-refresh.ts
 * Svrha: hook useDebouncedRefresh — ponovno učitavanje serverske stranice
 * (router.refresh) posle real-time događaja, grupisano: više događaja u
 * kratkom roku (npr. promena statusa šalje događaj i na ticket:<id> i na staff,
 * plus obaveštenje) daje samo jedno učitavanje.
 * router.refresh čuva stanje klijentskih komponenti (npr. započet komentar u formi).
 * Koriste ga: useTicketRealtime, useStaffRealtime, NotificationBell.
 */
"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/** Koliko se čeka na sledeće događaje pre učitavanja (ms). */
export const REFRESH_DELAY_MS = 300;

/** Zakazano učitavanje; jedno za celu stranicu, deli ga svaki hook. */
let pendingRefresh: ReturnType<typeof setTimeout> | null = null;

/**
 * Zakazuje jedno učitavanje; ako je već zakazano, ne zakazuje novo.
 * Ulaz: funkcija koja učitava stranicu (router.refresh).
 */
export function scheduleRefresh(refresh: () => void): void {
  if (pendingRefresh) return;
  pendingRefresh = setTimeout(() => {
    pendingRefresh = null;
    refresh();
  }, REFRESH_DELAY_MS);
}

/** Vraća funkciju koja zakazuje grupisano učitavanje trenutne stranice. */
export function useDebouncedRefresh(): () => void {
  const router = useRouter();
  return useCallback(() => scheduleRefresh(() => router.refresh()), [router]);
}
