/**
 * Fajl: src/components/layout/LanguageSwitcher.tsx
 * Svrha: dugme za promenu jezika interfejsa (SR / EN), prikazuje se u zaglavlju.
 * Koriste ga: početna stranica, stranice za prijavu, /api-docs i zaglavlje aplikacije (AppShell).
 * Povezano sa: src/lib/i18n/config.ts (lista jezika), src/lib/i18n/locale-cookie.ts (upis kolačića),
 * src/lib/i18n/request.ts (server čita isti kolačić i učitava prevode).
 *
 * Tok (vidi docs/05-dijagrami-sekvenci.md, SD-11):
 * 1. korisnik klikne na jezik, 2. upišemo izbor u kolačić NEXT_LOCALE,
 * 3. ako je korisnik prijavljen (persist), jezik se čuva i u profilu (PATCH /api/me, UC-07),
 *    pa važi i na drugom uređaju posle prijave,
 * 4. zatražimo od servera da ponovo iscrta stranicu, pa ceo interfejs dobija nove prevode.
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useApiClient } from "@/hooks/use-api-client";
import { ApiClientError } from "@/lib/api/client";
import { isLocale, locales, type Locale } from "@/lib/i18n/config";
import { setLocaleCookie } from "@/lib/i18n/locale-cookie";
import { cn } from "@/lib/utils";

/**
 * Komponenta sa po jednim dugmetom za svaki podržani jezik.
 * Trenutno aktivan jezik je istaknut i označen za čitače ekrana (aria-pressed).
 * Uloge: dostupno svima, i gostima i prijavljenim korisnicima.
 * Ulaz: persist — true samo u zaglavlju za prijavljene (jezik se čuva i u profilu).
 */
export function LanguageSwitcher({
  className,
  persist = false,
}: {
  className?: string;
  persist?: boolean;
}) {
  const t = useTranslations("language");
  const tErrors = useTranslations("errors");
  const api = useApiClient();
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

    // Korak 2 i 3: (prijavljen korisnik) sačuvaj jezik u profilu, pa osveži serverske
    // komponente da bi se učitali prevodi za novi jezik.
    startTransition(async () => {
      if (persist) {
        try {
          await api.patch("/me", { locale });
        } catch (error) {
          // Neuspeh čuvanja u profilu ne sprečava promenu jezika (kolačić je već upisan).
          toast.error(tErrors(error instanceof ApiClientError ? error.code : "INTERNAL_ERROR"));
        }
      }
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
