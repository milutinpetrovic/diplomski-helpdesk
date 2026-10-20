/**
 * Fajl: src/app/api/openapi/route.ts
 * Svrha: API ruta koja vraća OpenAPI 3 specifikaciju svih ruta (JSON).
 * Poziva je: Swagger UI na stranici /api-docs; isti JSON se uvozi u Postman.
 * Povezano sa: src/lib/openapi/document.ts, dokumentacija u
 * src/lib/openapi/routes/system.ts.
 */
import { withApi } from "@/lib/api/with-api";
import { AppError } from "@/lib/errors/app-error";
import { generateOpenApiDocument, isSwaggerEnabled } from "@/lib/openapi/document";

/**
 * GET /api/openapi
 * Vraća: OpenAPI dokument. Ako je Swagger isključen (SWAGGER_ENABLED=false), 404.
 * Uloge: svi, bez prijave.
 */
export const GET = withApi({ roles: "public" }, async () => {
  if (!isSwaggerEnabled()) throw new AppError("NOT_FOUND");
  return generateOpenApiDocument();
});
