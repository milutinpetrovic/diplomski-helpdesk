/**
 * Fajl: src/components/layout/LanguageSwitcher.tsx
 * Svrha: dugme za promenu jezika interfejsa (SR / EN), prikazuje se u zaglavlju.
 * Koristi ga: početna stranica (src/app/page.tsx), kasnije zaglavlje cele aplikacije.
 * Povezano sa: src/lib/i18n/config.ts (lista jezika), src/lib/i18n/locale-cookie.ts (upis kolačića),
 * src/lib/i18n/request.ts (server čita isti kolačić i učitava prevode).
 *
 * Tok (vidi docs/05-dijagrami-sekvenci.md, SD-11):
 * 1. korisnik klikne na jezik, 2. upišemo izbor u kolačić NEXT_LOCALE,
 * 3. zatražimo od servera da ponovo iscrta stranicu, pa ceo interfejs dobija nove prevode.
 * Kada u Fazi 4 bude postojala prijava, ovde se dodaje i PATCH /api/me da se jezik sačuva u profilu.
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { setLocaleCookie } from "@/lib/i18n/locale-cookie";
import { cn } from "@/lib/utils";

/**
 * Komponenta sa po jednim dugmetom za svaki podržani jezik.
 * Trenutno aktivan jezik je istaknut i označen za čitače ekrana (aria-pressed).
 * Uloge: dostupno svima, i gostima i prijavljenim korisnicima.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const activeLocale = useLocale();
  const router = useRouter();
  // isPending je true dok server ponovo iscrtava stranicu na novom jeziku.
  const [isPending, startTransition] = useTransition();

  /**
   * Menja jezik interfejsa.
   * Ulaz: izabrani jezik. Ne radi ništa ako je taj jezik već aktivan.
   */
  function changeLocale(locale: Locale) {
    if (locale === activeLocale) return;

    // Korak 1: zapamti izbor u kolačiću (važi za ceo sajt, godinu dana).
    setLocaleCookie(locale);

    // Korak 2: osveži serverske komponente da bi se učitali prevodi za novi jezik.
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn("inline-flex rounded-md border p-0.5", className)}
    >
      {locales.map((locale) => {
        const isActive = isLocale(activeLocale) && activeLocale === locale;
        return (
          <Button
            key={locale}
            type="button"
            size="sm"
            variant={isActive ? "default" : "ghost"}
            aria-pressed={isActive}
            aria-label={t(`${locale}Full`)}
            disabled={isPending}
            onClick={() => changeLocale(locale)}
            className="h-7 px-2.5"
          >
            {t(locale)}
          </Button>
        );
      })}
    </div>
  );
}
