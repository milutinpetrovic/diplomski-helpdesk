/**
 * Fajl: src/components/auth/ForgotPasswordForm.tsx
 * Svrha: forma „Zaboravljena lozinka“ (UC-04, prvi korak) na stranici /forgot-password.
 * Tok: email -> POST /api/auth/password/forgot -> poruka da je link poslat
 * (ista poruka i kad nalog ne postoji, da se ne otkrije koji emailovi imaju nalog).
 * Povezano sa: src/app/api/auth/password/forgot/route.ts.
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { applyApiError } from "@/components/forms/apply-api-error";
import { Button } from "@/components/ui/button";
import { useApiClient } from "@/hooks/use-api-client";
import type { ErrorCode } from "@/lib/errors/codes";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

/** Forma za zahtev za novu lozinku. Uloge: gost. */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const api = useApiClient();
  const [formError, setFormError] = useState<ErrorCode | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  /** Slanje forme: API uvek odgovara 204 (osim kod previše pokušaja). */
  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      await api.post("/auth/password/forgot", values);
      setSentTo(values.email);
    } catch (error) {
      setFormError(applyApiError(error, setError, ["email"]));
    }
  }

  if (sentTo) {
    return <FormAlert variant="success">{t("forgot.successText", { email: sentTo })}</FormAlert>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField
        id="email"
        type="email"
        autoComplete="email"
        label={t("fields.email")}
        errorKey={errors.email?.message}
        {...register("email")}
      />
      {formError ? <FormAlert>{tErrors(formError)}</FormAlert> : null}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t("forgot.submit")}
      </Button>
    </form>
  );
}
