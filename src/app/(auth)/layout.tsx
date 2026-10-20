/**
 * Fajl: src/app/(auth)/layout.tsx
 * Svrha: zajednički raspored stranica za prijavu, registraciju i lozinku:
 * zaglavlje (naziv aplikacije i izbor jezika) i kartica sa formom na sredini ekrana.
 * Folder (auth) je „grupa ruta“: zagrade znače da se naziv foldera NE vidi u
 * adresi (stranice su /login, /register...), a služi samo za zajednički raspored.
 * Pristup: gosti (prijavljene korisnike proxy.ts šalje na /dashboard).
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

/** Raspored stranica za prijavu (serverska komponenta). */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("common");

  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-semibold">
            {t("appName")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      {/* Forma na sredini; na telefonu zauzima celu širinu (sa razmakom od ivica). */}
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
