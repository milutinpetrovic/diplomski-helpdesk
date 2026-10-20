/**
 * Fajl: src/components/auth/NewPasswordForm.tsx
 * Svrha: forma za novu lozinku (nova lozinka + ponovljena lozinka). Koristi se na dva mesta:
 *   - /reset-password: posle klika na link iz emaila (UC-04); posle uspeha vodi na /dashboard
 *   - /profile: promena lozinke prijavljenog korisnika (UC-06); posle uspeha samo poruka
 * Tok: Zod provera (resetPasswordFormSchema) -> POST /api/auth/password/reset.
 * Povezano sa: src/app/api/auth/password/reset/route.ts.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { applyApiError } from "@/components/forms/apply-api-error";
import { Button } from "@/components/ui/button";
import { useApiClient } from "@/hooks/use-api-client";
import type { ErrorCode } from "@/lib/errors/codes";
import { resetPasswordFormSchema, type ResetPasswordFormInput } from "@/lib/validation/auth";

/**
 * Forma za novu lozinku.
 * Ulaz: submitLabel i successMessage (prevedeni tekstovi), redirectTo — kuda
 * posle uspeha (ako nije zadato, forma se samo isprazni).
 * Uloge: svi prijavljeni (sesija iz linka za reset ili obična sesija).
 */
export function NewPasswordForm({
  submitLabel,
  successMessage,
  redirectTo,
}: {
  submitLabel: string;
  successMessage: string;
  redirectTo?: string;
}) {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const api = useApiClient();
  const router = useRouter();
  const [formError, setFormError] = useState<ErrorCode | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  /** Slanje forme: API dobija samo novu lozinku. */
  async function onSubmit({ password }: ResetPasswordFormInput) {
    setFormError(null);
    try {
      await api.post("/auth/password/reset", { password });
      // Uspeh: kratka poruka, pa prelazak dalje ili prazna forma.
      toast.success(successMessage);
      if (redirectTo) router.replace(redirectTo);
      else reset();
    } catch (error) {
      setFormError(applyApiError(error, setError, ["password"]));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField
        id="password"
        type="password"
        autoComplete="new-password"
        label={t("fields.newPassword")}
        hint={t("passwordHint")}
        errorKey={errors.password?.message}
        {...register("password")}
      />
      <FormField
        id="confirmPassword"
        type="password"
        autoComplete="new-password"
        label={t("fields.confirmPassword")}
        errorKey={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      {formError ? <FormAlert>{tErrors(formError)}</FormAlert> : null}
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
