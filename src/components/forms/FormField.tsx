/**
 * Fajl: src/components/forms/FormField.tsx
 * Svrha: jedno polje forme: labela, polje za unos, opcioni savet ispod polja
 * i prevedena poruka greške. Povezuje labelu, polje i poruke preko id-jeva
 * (htmlFor, aria-describedby, aria-invalid), da bi čitač ekrana pročitao i
 * grešku (pristupačnost, NFZ-4).
 * Koriste ga: sve forme (prijava, registracija, lozinka, profil).
 * Povezano sa: Zod šeme (poruke greške su ključevi prevoda, npr. "passwordWeak"),
 * messages/*.json (sekcija validation).
 */
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Svojstva polja: sve što prima <input>, plus labela, savet i ključ greške. */
interface FormFieldProps extends React.ComponentProps<"input"> {
  /** id polja (obavezan, povezuje labelu i poruke). */
  id: string;
  /** Prevedena labela. */
  label: string;
  /** Prevedeni savet ispod polja (npr. pravila za lozinku). */
  hint?: string;
  /** Ključ greške iz Zod šeme ili API-ja (npr. "emailInvalid"); prevodi se ovde. */
  errorKey?: string;
}

/**
 * Polje forme sa labelom i porukom greške.
 * Ulaz: FormFieldProps; ostala svojstva (name, onChange, ref iz react-hook-form) idu na <input>.
 */
export function FormField({ id, label, hint, errorKey, ...inputProps }: FormFieldProps) {
  const t = useTranslations("validation");
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Nepoznat ključ (npr. podrazumevana poruka Zod-a) prikazuje se kao opšta greška.
  const errorText = errorKey ? (t.has(errorKey) ? t(errorKey) : t("invalid")) : null;
  const describedBy = [hint ? hintId : null, errorText ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={errorText ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && !errorText ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errorText ? (
        <p id={errorId} className="text-sm text-destructive">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
