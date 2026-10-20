/**
 * Fajl: src/app/(auth)/login/page.tsx
 * Svrha: stranica /login — prijava emailom i lozinkom (UC-02) ili Google nalogom (UC-03).
 * Parametri adrese:
 *   - ?next=/putanja — kuda posle prijave (postavlja ga proxy.ts kad gost otvori zaštićenu stranicu)
 *   - ?error=KOD — greška iz callback-a (npr. istekao link), prikazuje se prevedena
 * Pristup: gost.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthDivider } from "@/components/auth/AuthDivider";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isErrorCode } from "@/lib/errors/codes";
import { safeNextPath } from "@/lib/validation/auth";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

/** Stranica za prijavu (serverska komponenta; forma je klijentska). */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("auth");
  const params = await searchParams;

  // Korak 1: bezbedna putanja za povratak i kod greške iz adrese (ako je poznat).
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const errorParam = typeof params.error === "string" ? params.error : null;
  const initialError = isErrorCode(errorParam) ? errorParam : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("login.title")}</h1>
        </CardTitle>
        <CardDescription>{t("login.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LoginForm next={next} initialError={initialError} />
        <Link
          href="/forgot-password"
          className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("login.forgotLink")}
        </Link>
        <AuthDivider />
        <GoogleButton next={next} />
        <p className="text-center text-sm text-muted-foreground">
          {t("login.noAccount")}{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("login.registerLink")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
