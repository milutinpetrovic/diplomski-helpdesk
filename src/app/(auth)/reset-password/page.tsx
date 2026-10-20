/**
 * Fajl: src/app/(auth)/reset-password/page.tsx
 * Svrha: stranica /reset-password — unos nove lozinke (UC-04, drugi korak).
 * Korisnik dolazi ovde klikom na link iz emaila: /api/auth/callback proverava
 * link, prijavljuje ga privremenom sesijom i preusmerava ovde.
 * Pristup: samo sa sesijom (bez nje proxy.ts vodi na /forgot-password).
 */
import { getTranslations } from "next-intl/server";

import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_NEXT_PATH } from "@/lib/validation/auth";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

/** Stranica za novu lozinku; posle uspeha korisnik ide na kontrolni panel. */
export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("title")}</h1>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <NewPasswordForm
          submitLabel={t("submit")}
          successMessage={t("success")}
          redirectTo={DEFAULT_NEXT_PATH}
        />
      </CardContent>
    </Card>
  );
}
