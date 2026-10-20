/**
 * Fajl: src/app/layout.tsx
 * Svrha: osnovni (root) raspored cele aplikacije: <html> i <body>, fontovi, globalni stilovi
 * i provajder prevoda koji omogućava klijentskim komponentama da koriste useTranslations.
 * Koristi ga: Next.js automatski, za svaku stranicu u aplikaciji.
 * Povezano sa: src/lib/i18n/request.ts (odakle next-intl dobija jezik i prevode),
 * src/app/globals.css (tema i Tailwind).
 */
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import "./globals.css";

/**
 * Dozvoljava da se stranice iscrtavaju na serveru za svaki zahtev (blokirajuće).
 * Razlog: jezik se čita iz kolačića (a od Faze 4 i sesija korisnika), što Next.js
 * ne može unapred da pripremi kao statičku stranicu. Uz uključene Cache Components
 * (next.config.ts) bez ovoga build prijavljuje grešku. Pojedinačni podaci koji su
 * isti za sve korisnike (npr. kategorije) i dalje mogu da se keširaju sa "use cache".
 */
export const instant = false;

/**
 * Naslov i opis stranice (prikazuju se u tabu pregledača i u pretraživačima),
 * na jeziku koji je korisnik izabrao.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

/**
 * Osnovni raspored.
 * Ulaz: children, tj. sadržaj trenutne stranice.
 * Fontovi Geist se učitavaju lokalno iz npm paketa "geist" (nema zahteva ka Google Fonts),
 * i podržavaju srpska slova (č, ć, š, ž, đ).
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Jezik iz kolačića; koristi se za atribut lang (važno za čitače ekrana i pretraživače).
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {/* Provajder prenosi jezik i prevode sa servera klijentskim komponentama. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
