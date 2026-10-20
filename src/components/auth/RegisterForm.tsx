/**
 * Fajl: src/components/auth/RegisterForm.tsx
 * Svrha: forma za registraciju (UC-01) na stranici /register.
 * Tok: Zod provera (registerFormSchema, uključuje i „Ponovite lozinku“) ->
 * POST /api/auth/register -> poruka „Proverite email“; nalog se aktivira
 * klikom na link iz emaila. Ponovljena lozinka se ne šalje serveru.
 * Povezano sa: src/app/api/auth/register/route.ts, docs/05 SD-02.
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
import { registerFormSchema, type RegisterFormInput } from "@/lib/validation/auth";

/** Forma za registraciju. Uloge: gost (nalog uvek dobija ulogu korisnik). */
export function RegisterForm() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const api = useApiClient();
  const [formError, setFormError] = useState<ErrorCode | null>(null);
  // Email na koji je poslat link (posle uspešne registracije forma se zamenjuje porukom).
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });

  /** Slanje forme: API dobija samo ime, email i lozinku. */
  async function onSubmit(form: RegisterFormInput) {
    const values = { fullName: form.fullName, email: form.email, password: form.password };
    setFormError(null);
    try {
      await api.post("/auth/register", values);
      setSentTo(values.email);
    } catch (error) {
      setFormError(applyApiError(error, setError, ["fullName", "email", "password"]));
    }
  }

  // Posle uspeha: samo poruka „Proverite email“.
  if (sentTo) {
    return (
      <FormAlert variant="success">
        <p className="font-medium">{t("register.successTitle")}</p>
        <p>{t("register.successText", { email: sentTo })}</p>
      </FormAlert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField
        id="fullName"
        autoComplete="name"
        label={t("fields.fullName")}
        errorKey={errors.fullName?.message}
        {...register("fullName")}
      />
      <FormField
        id="email"
        type="email"
        autoComplete="email"
        label={t("fields.email")}
        errorKey={errors.email?.message}
        {...register("email")}
      />
      <FormField
        id="password"
        type="password"
        autoComplete="new-password"
        label={t("fields.password")}
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
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t("register.submit")}
      </Button>
    </form>
  );
}
