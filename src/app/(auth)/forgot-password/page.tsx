/**
 * Fajl: src/app/(auth)/forgot-password/page.tsx
 * Svrha: stranica /forgot-password — zahtev za link za novu lozinku (UC-04, prvi korak).
 * Pristup: gost.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("auth.forgot");
  return { title: t("title") };
}

/** Stranica „Zaboravljena lozinka“ (serverska komponenta; forma je klijentska). */
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("title")}</h1>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ForgotPasswordForm />
        <Link
          href="/login"
          className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </CardContent>
    </Card>
  );
}
