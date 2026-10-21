/**
 * Fajl: next.config.ts
 * Svrha: podešavanja Next.js aplikacije.
 * - cacheComponents i partialPrefetching: podrazumevana podešavanja Next.js 16 šablona
 *   (keširanje na nivou komponenti i delimično predučitavanje stranica).
 * - experimental.instantInsights.validationLevel = "manual-warning": razvojni
 *   server proverava „instant“ navigaciju samo za stranice koje to izričito traže
 *   (`export const instant = true`). Sve naše stranice čitaju sesiju iz kolačića,
 *   pa se namerno iscrtavaju po zahtevu (root layout: `instant = false`); bez ovog
 *   podešavanja razvojni server bi na svakoj stranici prikazivao upozorenje „Instant“.
 * - turbopack pravilo: obrada CSS-a kroz Tailwind.
 * - createNextIntlPlugin: povezuje next-intl sa fajlom koji određuje jezik i prevode po zahtevu.
 */
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Putanja do konfiguracije prevoda (naš raspored foldera je src/lib/i18n, a ne podrazumevani src/i18n).
const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

export default withNextIntl(nextConfig);
