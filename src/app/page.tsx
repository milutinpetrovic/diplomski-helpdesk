/**
 * Fajl: src/app/page.tsx
 * Svrha: početna stranica (/). U Fazi 1 prikazuje naziv i kratak opis aplikacije
 * i dugme za promenu jezika. U Fazi 4 dobija dugmad Prijava i Registracija,
 * a prijavljenog korisnika preusmerava na /dashboard (vidi docs/06-api-i-stranice.md).
 * Pristup: svi (i gosti).
 */
import { BellRing, CircleCheckBig, MessageSquarePlus, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Ključevi tri glavne mogućnosti aplikacije (tekstovi su u messages/*.json pod home.features). */
const FEATURES: { key: "create" | "track" | "resolve"; icon: LucideIcon }[] = [
  { key: "create", icon: MessageSquarePlus },
  { key: "track", icon: BellRing },
  { key: "resolve", icon: CircleCheckBig },
];

/**
 * Početna stranica (serverska komponenta).
 * Svi tekstovi dolaze iz prevoda za trenutno izabrani jezik.
 */
export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <div className="flex flex-1 flex-col">
      {/* Zaglavlje: naziv aplikacije levo, izbor jezika desno. */}
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <span className="font-semibold">{t("title")}</span>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-12 sm:py-20">
        {/* Uvodni deo: naslov i opis. */}
        <section className="flex flex-col gap-4 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground">{t("subtitle")}</p>
        </section>

        {/* Tri kartice sa glavnim mogućnostima; na telefonu jedna ispod druge, na većem ekranu u redu. */}
        <section className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <Card key={key}>
              <CardHeader>
                <Icon className="mb-2 size-6 text-muted-foreground" aria-hidden="true" />
                <CardTitle>{t(`features.${key}.title`)}</CardTitle>
                <CardDescription>{t(`features.${key}.description`)}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        {/* Privremena napomena dok prijava ne postoji (uklanja se u Fazi 4). */}
        <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
      </main>
    </div>
  );
}
