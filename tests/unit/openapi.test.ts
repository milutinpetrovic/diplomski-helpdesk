/**
 * Unit testovi: OpenAPI dokument (src/lib/openapi) i ruta GET /api/openapi.
 *
 * Proverava da dokument sadrži rute, šemu greške i dugme „Authorize“
 * (bearerAuth), da je SVAKA API ruta iz src/app/api upisana u Swagger
 * (pravilo iz CLAUDE.md) i da se Swagger gasi sa SWAGGER_ENABLED=false.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { generateOpenApiDocument } from "@/lib/openapi/document";

// Ruta ne koristi prijavu, ali withApi uvozi auth-guard (a on next/headers).
vi.mock("@/lib/supabase/server", () => ({}));

const { GET } = await import("@/app/api/openapi/route");

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Poziva GET /api/openapi kao što bi to uradio Next.js. */
function callOpenApiRoute() {
  return GET(new Request("http://localhost/api/openapi"), { params: Promise.resolve({}) });
}

describe("OpenAPI", () => {
  it("dokument sadrži rute, šemu greške i bearerAuth", () => {
    const document = generateOpenApiDocument();
    expect(document.openapi).toBe("3.0.3");
    expect(document.paths?.["/api/openapi"]?.get).toBeDefined();
    expect(document.components?.schemas?.ApiError).toBeDefined();
    expect(document.components?.securitySchemes?.bearerAuth).toMatchObject({ scheme: "bearer" });
  });

  it("GET /api/openapi vraća dokument", async () => {
    const response = await callOpenApiRoute();
    expect(response.status).toBe(200);
    expect((await response.json()).info.title).toContain("API");
  });

  it("SWAGGER_ENABLED=false vraća 404", async () => {
    vi.stubEnv("SWAGGER_ENABLED", "false");
    const response = await callOpenApiRoute();
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  // Pravilo: nijedna ruta nije gotova dok nije u Swagger-u. Test čita sve
  // fajlove route.ts i proverava da je svaki izvezen metod (GET, POST...) dokumentovan.
  it("svaka API ruta iz src/app/api je u OpenAPI dokumentu", () => {
    const document = generateOpenApiDocument();
    const apiDir = path.join(process.cwd(), "src/app/api");
    const routeFiles = readdirSync(apiDir, { recursive: true, encoding: "utf8" }).filter(
      (file) => path.basename(file) === "route.ts",
    );
    expect(routeFiles.length).toBeGreaterThan(5);

    for (const file of routeFiles) {
      // src/app/api/tickets/[id]/route.ts -> /api/tickets/{id}
      const apiPath =
        "/api/" +
        path
          .dirname(file)
          .split(path.sep)
          .join("/")
          .replace(/\[(\w+)\]/g, "{$1}");
      const source = readFileSync(path.join(apiDir, file), "utf8");
      const methods = [...source.matchAll(/export const (GET|POST|PATCH|PUT|DELETE)\b/g)];
      for (const [, method] of methods) {
        const operation = document.paths?.[apiPath]?.[method!.toLowerCase() as "get"];
        expect(operation, `${method} ${apiPath} nije u Swagger-u`).toBeDefined();
      }
    }
  });
});
