/**
 * Unit testovi: OpenAPI dokument (src/lib/openapi) i ruta GET /api/openapi.
 *
 * Proverava da dokument sadrži rute, šemu greške i dugme „Authorize“
 * (bearerAuth), i da se Swagger gasi sa SWAGGER_ENABLED=false.
 */
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
});
