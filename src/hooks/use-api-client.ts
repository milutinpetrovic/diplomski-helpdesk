/**
 * Fajl: src/hooks/use-api-client.ts
 * Svrha: hook useApiClient — daje ApiClient podešen na trenutni jezik
 * interfejsa, da bi poruke grešaka iz API-ja stizale na tom jeziku.
 * Koriste ga: klijentske forme (prijava, registracija, profil...) i dugmad
 * koja pozivaju API (odjava, promena jezika).
 * Povezano sa: src/lib/api/client.ts (ApiClient), next-intl (useLocale).
 */
"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";

import { ApiClient } from "@/lib/api/client";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

/**
 * Vraća ApiClient za trenutni jezik. Isti objekat se koristi dok se jezik ne promeni.
 * Uloge: svi (i gosti, npr. forma za prijavu).
 */
export function useApiClient(): ApiClient {
  const locale = useLocale();
  return useMemo(() => new ApiClient(isLocale(locale) ? locale : defaultLocale), [locale]);
}
