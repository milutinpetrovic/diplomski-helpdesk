/**
 * Fajl: src/components/forms/FormField.tsx
 * Svrha: jedno polje forme: labela, polje za unos, opcioni savet ispod polja
 * i prevedena poruka greške. Tri vrste polja istog izgleda i ponašanja:
 * FormField (<input>), FormTextareaField (<textarea>) i FormSelectField (<select>). Povezuje labelu, polje i poruke preko id-jeva
 * (htmlFor, aria-describedby, aria-invalid), da bi čitač ekrana pročitao i
 * grešku (pristupačnost, NFZ-4).
 * Koriste ga: sve forme (prijava, registracija, lozinka, profil, novi zahtev).
 * Povezano sa: Zod šeme (poruke greške su ključevi prevoda, npr. "passwordWeak"),
 * messages/*.json (sekcija validation).
 */
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

/** Zajednička svojstva svih vrsta polja: labela, savet i ključ greške. */
interface FieldProps {
  /** id polja (obavezan, povezuje labelu i poruke). */
  id: string;
  /** Prevedena labela. */
  label: string;
  /** Prevedeni savet ispod polja (npr. pravila za lozinku). */
  hint?: string;
  /** Ključ greške iz Zod šeme ili API-ja (npr. "emailInvalid"); prevodi se ovde. */
  errorKey?: string;
}

/** Atributi pristupačnosti koje dobija sam element polja. */
interface ControlA11y {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

/**
 * Okvir polja: labela, element polja (iz renderControl) i poruke ispod njega.
 * Ulaz: FieldProps i funkcija koja crta element sa datim atributima pristupačnosti.
 */
function FieldFrame({
  id,
  label,
  hint,
  errorKey,
  renderControl,
}: FieldProps & { renderControl: (a11y: ControlA11y) => React.ReactNode }) {
  const t = useTranslations("validation");
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Nepoznat ključ (npr. podrazumevana poruka Zod-a) prikazuje se kao opšta greška.
  const errorText = errorKey ? (t.has(errorKey) ? t(errorKey) : t("invalid")) : null;
  const describedBy = [hint ? hintId : null, errorText ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {renderControl({
        id,
        "aria-invalid": errorText ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
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

/**
 * Polje forme sa labelom i porukom greške.
 * Ulaz: FieldProps; ostala svojstva (name, onChange, ref iz react-hook-form) idu na <input>.
 */
export function FormField({
  id,
  label,
  hint,
  errorKey,
  ...inputProps
}: FieldProps & React.ComponentProps<"input">) {
  return (
    <FieldFrame
      {...{ id, label, hint, errorKey }}
      renderControl={(a11y) => <Input {...a11y} {...inputProps} />}
    />
  );
}

/** Višeredno polje (npr. opis problema). Ostala svojstva idu na <textarea>. */
export function FormTextareaField({
  id,
  label,
  hint,
  errorKey,
  ...textareaProps
}: FieldProps & React.ComponentProps<"textarea">) {
  return (
    <FieldFrame
      {...{ id, label, hint, errorKey }}
      renderControl={(a11y) => <Textarea {...a11y} {...textareaProps} />}
    />
  );
}

/** Padajuća lista (npr. kategorija). Opcije su deca; ostala svojstva idu na <select>. */
export function FormSelectField({
  id,
  label,
  hint,
  errorKey,
  ...selectProps
}: FieldProps & React.ComponentProps<"select">) {
  return (
    <FieldFrame
      {...{ id, label, hint, errorKey }}
      renderControl={(a11y) => <NativeSelect {...a11y} {...selectProps} />}
    />
  );
}
