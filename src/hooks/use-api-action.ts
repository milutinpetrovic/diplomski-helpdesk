/**
 * Fajl: src/hooks/use-api-action.ts
 * Svrha: hook useApiAction — zajednički tok za dugmad koja menjaju podatke
 * preko API-ja (preuzmi zahtev, promeni status, dodeli...):
 *   1. dok poziv traje, dugme je onemogućeno (pending)
 *   2. uspeh: kratka poruka (toast) i ponovno učitavanje serverske stranice
 *      (router.refresh), pa se odmah vide novi status, istorija i dugmad
 *   3. greška: prevedena poruka (errors.<KOD>), nikad tiho gutanje (NFZ-6)
 * Koriste ga: TicketActions, CommentForm i RatingForm (stranica zahteva).
 * Povezano sa: useApiClient, ApiClientError (kod greške), messages/*.json (errors).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useApiClient } from "@/hooks/use-api-client";
import { ApiClientError, type ApiClient } from "@/lib/api/client";

/**
 * Vraća: run(poziv, porukaZaUspeh) i pending (da li poziv traje).
 * poziv dobija ApiClient i vraća Promise; porukaZaUspeh je već preveden tekst.
 * Uloge: svi prijavljeni (koje akcije smeju, odlučuje API).
 */
export function useApiAction() {
  const api = useApiClient();
  const router = useRouter();
  const t = useTranslations("errors");
  const [pending, setPending] = useState(false);

  /**
   * Izvršava jedan poziv API-ja sa porukom o uspehu ili grešci.
   * Vraća: true ako je poziv uspeo (npr. forma tada briše uneti tekst).
   */
  async function run(
    call: (api: ApiClient) => Promise<unknown>,
    successMessage: string,
  ): Promise<boolean> {
    setPending(true);
    try {
      await call(api);
      toast.success(successMessage);
      router.refresh();
      return true;
    } catch (error) {
      const code = error instanceof ApiClientError ? error.code : "INTERNAL_ERROR";
      toast.error(t(code));
      return false;
    } finally {
      setPending(false);
    }
  }

  return { run, pending };
}
