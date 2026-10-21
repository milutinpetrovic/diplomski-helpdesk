/**
 * Unit testovi: generator Postman kolekcije (scripts/postman-generate.mts), bez aplikacije.
 *
 * Proverava:
 *   - pretvaranje OpenAPI šeme u JSON Schemu ($ref, nullable, izbačeni opisi)
 *   - poređenje ruta iz OpenAPI-ja i poziva iz scenarija (nova ruta bez testa = greška)
 *   - Postman testove za uspeh (šema) i grešku (oblik { error } i kod)
 *   - da je kolekcija ista pri svakom pravljenju (zbog provere --check u CI-u)
 */
import { describe, expect, it } from "vitest";

import {
  buildCollection,
  buildTests,
  compareCoverage,
  type OpenApiDocument,
  type ScenarioFolder,
  toJsonSchema,
} from "../../scripts/postman-generate.mjs";

/** Mali OpenAPI dokument sa dve rute i jednom zajedničkom šemom. */
const DOC: OpenApiDocument = {
  paths: {
    "/api/items/{id}": {
      get: {
        summary: "Detalji",
        responses: {
          "200": {
            content: { "application/json": { schema: { $ref: "#/components/schemas/Item" } } },
          },
          "404": {},
        },
      },
    },
    "/api/items": { post: { responses: { "201": {} } } },
  },
  components: {
    schemas: {
      Item: {
        type: "object",
        description: "Stavka.",
        properties: {
          id: { type: "string", format: "uuid", example: "1" },
          note: { type: "string", nullable: true },
        },
        required: ["id", "note"],
      },
    },
  },
};

/** Scenario koji pokriva obe rute. */
const SCENARIO: ScenarioFolder[] = [
  {
    name: "Stavke",
    description: "Test.",
    items: [
      { name: "Nova", operation: "POST /api/items", role: "customer", status: 201 },
      {
        name: "Detalji",
        operation: "GET /api/items/{id}",
        url: "/api/items/{{itemId}}",
        role: "guest",
        status: 200,
        save: { firstId: "items.0.id" },
      },
    ],
  },
];

describe("toJsonSchema", () => {
  it("zamenjuje $ref, pretvara nullable i izbacuje opise, primere i format", () => {
    expect(toJsonSchema({ $ref: "#/components/schemas/Item" }, DOC)).toEqual({
      type: "object",
      properties: {
        id: { type: "string" },
        note: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
      required: ["id", "note"],
    });
  });

  it("nepoznata referenca je greška", () => {
    expect(() => toJsonSchema({ $ref: "#/components/schemas/Nema" }, DOC)).toThrow("Nema");
  });
});

describe("compareCoverage", () => {
  it("sve rute pokrivene -> nema razlika", () => {
    expect(compareCoverage(DOC, SCENARIO)).toEqual({ missing: [], unknown: [] });
  });

  it("ruta bez poziva i poziv bez rute se prijavljuju", () => {
    const partial: ScenarioFolder[] = [
      {
        name: "X",
        description: "",
        items: [{ name: "Y", operation: "DELETE /api/items", role: "admin", status: 204 }],
      },
    ];
    expect(compareCoverage(DOC, partial)).toEqual({
      missing: ["GET /api/items/{id}", "POST /api/items"],
      unknown: ["DELETE /api/items"],
    });
  });
});

describe("buildTests", () => {
  const operation = DOC.paths["/api/items/{id}"]!.get!;

  it("uspeh: status, šema iz OpenAPI-ja i čuvanje promenljive", () => {
    const lines = buildTests(SCENARIO[0]!.items[1]!, operation, DOC).join("\n");
    expect(lines).toContain("pm.response.to.have.status(200)");
    expect(lines).toContain("pm.response.to.have.jsonSchema(");
    expect(lines).toContain(
      'pm.collectionVariables.set("firstId", pm.response.json().items[0].id);',
    );
  });

  it("greška: oblik { error: { code, message } } i očekivani kod", () => {
    const lines = buildTests(
      {
        name: "Nema",
        operation: "GET /api/items/{id}",
        role: "guest",
        status: 404,
        errorCode: "NOT_FOUND",
      },
      operation,
      DOC,
    ).join("\n");
    expect(lines).toContain("pm.response.to.have.status(404)");
    expect(lines).toContain("error.message");
    expect(lines).toContain('pm.expect(error.code).to.eql("NOT_FOUND")');
    expect(lines).not.toContain("jsonSchema");
  });
});

describe("buildCollection", () => {
  it("isti ulaz daje istu kolekciju; gost bez tokena, ostali sa Bearer tokenom uloge", () => {
    const collection = buildCollection(DOC, SCENARIO);
    expect(buildCollection(DOC, SCENARIO)).toEqual(collection);

    const [folder] = collection.item as { item: { request: { auth: unknown } }[] }[];
    expect(folder!.item[0]!.request.auth).toEqual({
      type: "bearer",
      bearer: [{ key: "token", value: "{{customerToken}}", type: "string" }],
    });
    expect(folder!.item[1]!.request.auth).toEqual({ type: "noauth" });
  });

  it("operacija koje nema u OpenAPI-ju je greška", () => {
    const wrong: ScenarioFolder[] = [
      {
        name: "X",
        description: "",
        items: [{ name: "Y", operation: "GET /api/nema", role: "admin", status: 200 }],
      },
    ];
    expect(() => buildCollection(DOC, wrong)).toThrow("GET /api/nema");
  });
});
