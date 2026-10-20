"use client";

/**
 * Fajl: src/components/api-docs/SwaggerView.tsx
 * Svrha: prikaz Swagger UI-a (spisak svih API poziva sa mogućnošću da se
 * isprobaju). Swagger UI radi samo u pregledaču, pa se učitava tek na
 * klijentu (bez iscrtavanja na serveru).
 * Koristi ga: stranica /api-docs (src/app/api-docs/page.tsx).
 * Povezano sa: GET /api/openapi (odatle čita specifikaciju).
 */
import dynamic from "next/dynamic";

import "swagger-ui-react/swagger-ui.css";

/** Swagger UI se učitava samo u pregledaču (koristi window i document). */
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

/**
 * Komponenta sa Swagger UI-om.
 * Ulaz: url — adresa OpenAPI specifikacije (npr. /api/openapi).
 * persistAuthorization: token unet preko „Authorize“ ostaje posle osvežavanja stranice.
 */
export function SwaggerView({ url }: { url: string }) {
  return (
    <div className="rounded-lg border bg-white">
      <SwaggerUI url={url} persistAuthorization docExpansion="list" />
    </div>
  );
}
