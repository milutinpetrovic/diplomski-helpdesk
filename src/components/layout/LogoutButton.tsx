/**
 * Fajl: src/components/layout/LogoutButton.tsx
 * Svrha: dugme „Odjava“ (UC-05) u zaglavlju: POST /api/auth/logout, pa
 * prelazak na /login.
 * Koristi ga: AppShell.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useApiClient } from "@/hooks/use-api-client";
import { ApiClientError } from "@/lib/api/client";

/** Dugme za odjavu. Uloge: svi prijavljeni. */
export function LogoutButton() {
  const t = useTranslations("nav");
  const tErrors = useTranslations("errors");
  const api = useApiClient();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  /** Odjava: server briše kolačiće sesije; zatim stranica za prijavu. */
  async function logout() {
    setPending(true);
    try {
      await api.post("/auth/logout");
    } catch (error) {
      // Ako sesija već ne postoji (401), korisnik je ionako odjavljen.
      if (!(error instanceof ApiClientError && error.code === "UNAUTHENTICATED")) {
        toast.error(tErrors(error instanceof ApiClientError ? error.code : "INTERNAL_ERROR"));
        setPending(false);
        return;
      }
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout} disabled={pending}>
      <LogOut aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{t("logout")}</span>
    </Button>
  );
}
