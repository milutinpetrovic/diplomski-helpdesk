/**
 * Fajl: src/components/auth/LoginForm.tsx
 * Svrha: forma za prijavu emailom i lozinkom (UC-02) na stranici /login.
 * Tok: Zod provera u formi (loginSchema) -> POST /api/auth/login (ApiClient)
 * -> uspeh: prelazak na stranicu iz ?next (podrazumevano /dashboard);
 * greška: prevedena poruka iznad dugmeta (npr. „Pogrešan email ili lozinka“).
 * Povezano sa: src/app/api/auth/login/route.ts, src/lib/validation/auth.ts.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormAlert } from "@/components/forms/FormAlert";
import { FormField } from "@/components/forms/FormField";
import { applyApiError } from "@/components/forms/apply-api-error";
import { Button } from "@/components/ui/button";
import { useApiClient } from "@/hooks/use-api-client";
import type { ErrorCode } from "@/lib/errors/codes";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

/**
 * Forma za prijavu.
 * Ulaz: next — kuda posle prijave; initialError — kod greške iz linka
 * (npr. /login?error=AUTH_CALLBACK_FAILED posle neuspele Google prijave).
 * Uloge: gost.
 */
export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError: ErrorCode | null;
}) {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const api = useApiClient();
  const router = useRouter();
  const [formError, setFormError] = useState<ErrorCode | null>(initialError);

  // Forma sa Zod proverom (ista šema kao na serveru).
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  /** Slanje forme: poziv API-ja, pa prelazak na sledeću stranicu ili prikaz greške. */
  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      // Korak 1: prijava; server upisuje kolačiće sesije.
      await api.post("/auth/login", values);
      // Korak 2: prelazak na traženu stranicu; refresh učitava sesiju i jezik iz profila.
      router.replace(next);
      router.refresh();
    } catch (error) {
      // Korak 3: greška ispod polja ili iznad dugmeta.
      setFormError(applyApiError(error, setError, ["email", "password"]));
    }
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
      <FormField
        id="password"
        type="password"
        autoComplete="current-password"
        label={t("fields.password")}
        errorKey={errors.password?.message}
        {...register("password")}
      />
      {formError ? <FormAlert>{tErrors(formError)}</FormAlert> : null}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t("login.submit")}
      </Button>
    </form>
  );
}
