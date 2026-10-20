/**
 * Fajl: src/lib/openapi/document.ts
 * Svrha: pravi ceo OpenAPI 3 dokument iz registra (sve rute i šeme) i
 * proverava da li je Swagger uključen (SWAGGER_ENABLED).
 * Koriste ga: GET /api/openapi (src/app/api/openapi/route.ts) i stranica /api-docs.
 * Povezano sa: registry.ts, routes/*.ts, .env.example.
 */
import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

import { registry } from "@/lib/openapi/registry";
import "@/lib/openapi/routes";

/**
 * Da li su Swagger UI i OpenAPI JSON dostupni. Podrazumevano da (deo
 * prezentacije rada); isključuje se sa SWAGGER_ENABLED=false.
 */
export function isSwaggerEnabled(): boolean {
  return process.env.SWAGGER_ENABLED !== "false";
}

/** Pravi OpenAPI dokument (verzija 3.0, koju podržavaju Swagger UI i Postman). */
export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Tehnička podrška — API",
      version: "0.5.0",
      description:
        "API veb aplikacije za tehničku podršku (diplomski rad, Milutin Petrović 3407). " +
        "Greške imaju jedinstven oblik { error: { code, message, details } }; " +
        "kod greške je stabilan i interfejs ga prevodi.",
    },
    servers: [{ url: "/" }],
    tags: [
      {
        name: "Auth",
        description: "Registracija, prijava (email i Google), odjava i reset lozinke.",
      },
      { name: "Profile", description: "Profil prijavljenog korisnika." },
      {
        name: "Tickets",
        description: "Zahtevi: lista, kreiranje, detalji, izmena, status, dodela, istorija.",
      },
      { name: "Comments", description: "Komentari i interne beleške na zahtevu." },
      { name: "Ratings", description: "Ocena zadovoljstva (CSAT 1–5) za rešen zahtev." },
      { name: "Categories", description: "Kategorije zahteva." },
      { name: "Admin", description: "Tim podrške i administracija naloga." },
      { name: "System", description: "Sistemske rute (OpenAPI specifikacija)." },
    ],
  });
}
