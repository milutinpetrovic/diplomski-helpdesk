/**
 * Fajl: src/app/api-docs/page.tsx
 * Svrha: stranica /api-docs sa Swagger UI-om — pregled svih API poziva
 * aplikacije, za razvoj, odbranu rada i Postman.
 * Pristup: svi; ako je SWAGGER_ENABLED=false, stranica ne postoji (404).
 * Povezano sa: SwaggerView (prikaz), GET /api/openapi (specifikacija),
 * docs/06-api-i-stranice.md.
 */
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SwaggerView } from "@/components/api-docs/SwaggerView";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { isSwaggerEnabled } from "@/lib/openapi/document";

/** Naslov taba za ovu stranicu (na izabranom jeziku). */
export async function generateMetadata() {
  const t = await getTranslations("apiDocs");
  return { title: t("title") };
}

/**
 * Stranica API dokumentacije (serverska komponenta): naslov i opis iz
 * prevoda, ispod Swagger UI.
 */
export default async function ApiDocsPage() {
  // Korak 1: ako je Swagger isključen, stranica ne postoji.
  if (!isSwaggerEnabled()) notFound();

  const t = await getTranslations("apiDocs");

  // Korak 2: zaglavlje i Swagger UI.
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <span className="font-semibold">{t("title")}</span>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8">
        <p className="text-muted-foreground">{t("description")}</p>
        <SwaggerView url="/api/openapi" />
      </main>
    </div>
  );
}
