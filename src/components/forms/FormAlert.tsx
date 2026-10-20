/**
 * Fajl: src/components/forms/FormAlert.tsx
 * Svrha: poruka iznad ili ispod forme — greška (npr. „Pogrešan email ili
 * lozinka“) ili uspeh (npr. „Proverite email“). Ima role="alert", pa je čitač
 * ekrana odmah pročita.
 * Koriste ga: forme za prijavu, registraciju i lozinku, stranica /login (greška iz linka).
 */
import type * as React from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Poruka forme.
 * variant: "error" (crvena) ili "success" (zelena); children: već preveden tekst.
 */
export function FormAlert({
  variant = "error",
  children,
}: {
  variant?: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = variant === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        variant === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-emerald-600/40 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
