/**
 * Fajl: src/components/layout/AppShell.tsx
 * Svrha: glavni raspored zaštićenog dela aplikacije (posle prijave):
 *   - zaglavlje: dugme menija (telefon), naziv aplikacije, izbor jezika, ime i uloga, odjava
 *   - bočni meni sa stavkama po ulozi (računar, od 768 px)
 *   - sadržaj stranice
 * Koristi ga: src/app/(app)/layout.tsx.
 * Povezano sa: NavLinks / nav-items.ts (meni po ulozi), MobileNav, LogoutButton,
 * LanguageSwitcher (za prijavljenog čuva jezik i u profilu).
 */
import type * as React from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { MobileNav } from "@/components/layout/MobileNav";
import { NavLinks } from "@/components/layout/NavLinks";
import type { Profile } from "@/lib/validation/profile";

/**
 * Raspored sa menijem (serverska komponenta).
 * Ulaz: profil prijavljenog korisnika i sadržaj stranice.
 */
export async function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const t = await getTranslations();

  return (
    <div className="flex flex-1 flex-col">
      {/* Link za korisnike tastature: preskače meni i vodi pravo na sadržaj (NFZ-4). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        {t("nav.skipToContent")}
      </a>

      {/* Zaglavlje. */}
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="flex h-14 items-center gap-2 px-4">
          <MobileNav role={profile.role} fullName={profile.fullName} />
          <Link href="/dashboard" className="truncate font-semibold">
            {t("common.appName")}
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher persist />
            {/* Ime i uloga; na telefonu samo ime, skraćeno ako je dugačko. */}
            <div className="hidden min-w-0 flex-col items-end leading-tight sm:flex">
              <span className="max-w-40 truncate text-sm font-medium">{profile.fullName}</span>
              <span className="text-xs text-muted-foreground">{t(`roles.${profile.role}`)}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Bočni meni (samo na širem ekranu). */}
        <aside className="hidden w-60 shrink-0 border-r md:block">
          <nav aria-label={t("nav.label")} className="sticky top-14 p-3">
            <NavLinks role={profile.role} />
          </nav>
        </aside>

        {/* Sadržaj stranice. */}
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
