/**
 * Fajl: src/components/profile/ProfileForm.tsx
 * Svrha: forma „Lični podaci“ na stranici /profile (UC-06, UC-07): ime i
 * jezik interfejsa. Email i uloga se samo prikazuju (ne mogu se menjati ovde).
 * Tok: Zod provera (profileFormSchema) -> PATCH /api/me -> poruka „Profil je
 * sačuvan“; ako je promenjen jezik, upisuje se i kolačić, pa se interfejs prevodi.
 * Povezano sa: src/app/api/me/route.ts, ProfileService.
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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useApiClient } from "@/hooks/use-api-client";
import type { ErrorCode } from "@/lib/errors/codes";
import { locales } from "@/lib/i18n/config";
import { setLocaleCookie } from "@/lib/i18n/locale-cookie";
import { profileFormSchema, type Profile, type ProfileFormInput } from "@/lib/validation/profile";

/** Forma za ime i jezik. Ulaz: trenutni profil. Uloge: svi prijavljeni. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations();
  const api = useApiClient();
  const router = useRouter();
  const [formError, setFormError] = useState<ErrorCode | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormInput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { fullName: profile.fullName, locale: profile.locale },
  });

  /** Čuvanje: PATCH /api/me, pa osvežavanje stranice (novo ime u zaglavlju, nov jezik). */
  async function onSubmit(values: ProfileFormInput) {
    setFormError(null);
    try {
      const updated = await api.patch<Profile>("/me", values);
      // Jezik iz profila važi i za interfejs (kolačić NEXT_LOCALE).
      if (updated.locale !== profile.locale) setLocaleCookie(updated.locale);
      toast.success(t("profile.saved"));
      // Sačuvane vrednosti postaju nove početne (dugme „Sačuvaj“ se gasi do sledeće izmene).
      reset({ fullName: updated.fullName, locale: updated.locale });
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ["fullName", "locale"]));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField
        id="fullName"
        autoComplete="name"
        label={t("auth.fields.fullName")}
        errorKey={errors.fullName?.message}
        {...register("fullName")}
      />
      {/* Email se ne menja (prikaz, ne polje forme). */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("auth.fields.email")}</Label>
        <p id="email" className="text-sm text-muted-foreground">
          {profile.email}
        </p>
      </div>
      {/* Izbor jezika: običan <select>, radi tastaturom i na telefonu. */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="locale">{t("profile.language")}</Label>
        <NativeSelect id="locale" {...register("locale")}>
          {locales.map((locale) => (
            <option key={locale} value={locale}>
              {t(`language.${locale}Full`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      {formError ? <FormAlert>{t(`errors.${formError}`)}</FormAlert> : null}
      <Button
        type="submit"
        disabled={isSubmitting || !isDirty}
        className="w-full sm:w-auto sm:self-start"
      >
        {t("profile.save")}
      </Button>
    </form>
  );
}
