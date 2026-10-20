/**
 * Fajl: src/app/(auth)/register/page.tsx
 * Svrha: stranica /register — registracija emailom (UC-01) ili Google nalogom (UC-03).
 * Pristup: gost. Svaki nov nalog dobija ulogu „korisnik“.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthDivider } from "@/components/auth/AuthDivider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_NEXT_PATH } from "@/lib/validation/auth";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("auth.register");
  return { title: t("title") };
}

/** Stranica za registraciju (serverska komponenta; forma je klijentska). */
export default async function RegisterPage() {
  const t = await getTranslations("auth");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("register.title")}</h1>
        </CardTitle>
        <CardDescription>{t("register.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RegisterForm />
        <AuthDivider />
        <GoogleButton next={DEFAULT_NEXT_PATH} />
        <p className="text-center text-sm text-muted-foreground">
          {t("register.haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("register.loginLink")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
