/**
 * Fajl: scripts/postman-generate.mts
 * Svrha: pravi Postman kolekciju postman/helpdesk.postman_collection.json iz
 * OpenAPI specifikacije (GET /api/openapi), da Postman i Swagger uvek opisuju
 * iste API pozive (Faza 9c, docs/08-testiranje.md, sekcija Postman).
 *
 * Kako radi:
 *   - SCENARIO (ispod) je spisak poziva redom kojim ih Postman/newman izvršava:
 *     prijava kao korisnik, agent i admin (token se čuva u promenljivoj), pa
 *     ceo život jednog zahteva, obaveštenja, analitika, administracija.
 *   - Za svaki poziv skripta iz OpenAPI-ja uzima opis rute i JSON šemu
 *     odgovora, i piše Postman testove: status, oblik odgovora (šema) i, za
 *     greške, oblik { error: { code, message } } sa očekivanim kodom.
 *   - Ako neka ruta iz OpenAPI-ja nema nijedan poziv u scenariju, ili poziv
 *     u scenariju nema rutu u OpenAPI-ju, skripta prijavljuje grešku. Tako
 *     nova ruta ne može da se doda bez Postman testa.
 *
 * Pokretanje (aplikacija mora da radi, npr. `pnpm dev` ili `pnpm start`):
 *   pnpm postman:generate            -> upisuje kolekciju
 *   pnpm postman:generate --check    -> samo proverava da je kolekcija ažurna (CI)
 * Adresa specifikacije: OPENAPI_URL (podrazumevano http://localhost:3000/api/openapi).
 * Radi u Node-u (22.18+) bez dodatnih paketa: Node sam uklanja TypeScript tipove.
 *
 * Povezano sa: src/lib/openapi/ (izvor specifikacije), postman/README.md
 * (uputstvo), package.json (postman:generate, test:api), .github/workflows/ci.yml
 * (posao e2e pokreće newman), tests/unit/postman-generate.test.ts.
 */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// =============================================================================
// 1. Tipovi: deo OpenAPI-ja koji skripta čita i opis jednog poziva u scenariju
// =============================================================================

/** JSON šema iz OpenAPI-ja (slobodan oblik, skripta je samo prepisuje). */
export type Schema = { [key: string]: unknown };

/** Jedna operacija iz OpenAPI-ja (npr. GET /api/tickets). */
interface OpenApiOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  responses: Record<string, { content?: { "application/json"?: { schema?: Schema } } }>;
}

/** Deo OpenAPI dokumenta koji se koristi. */
export interface OpenApiDocument {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, Schema> };
}

/** Uloga čiji se token šalje uz poziv; "guest" = bez prijave. */
type Role = "customer" | "agent" | "admin" | "guest" | "logout";

/** Jedan poziv u scenariju. */
export interface ScenarioRequest {
  /** Naziv u Postman-u (srpski, kaže šta se proverava). */
  name: string;
  /** Operacija iz OpenAPI-ja: "METOD /putanja" tačno kao u specifikaciji. */
  operation: string;
  /** Ko poziva (čiji token ide u Authorization zaglavlje). */
  role: Role;
  /** Stvarna adresa poziva sa Postman promenljivama, npr. /api/tickets/{{ticketId}}. */
  url?: string;
  /** Telo zahteva (JSON). */
  body?: unknown;
  /** Očekivani HTTP status. */
  status: number;
  /** Očekivani kod greške (za status 4xx). */
  errorCode?: string;
  /** Šta se iz odgovora čuva u promenljive kolekcije: { promenljiva: "putanja.u.json-u" }. */
  save?: Record<string, string>;
  /** Dodatni Postman testovi (JavaScript linije). */
  checks?: string[];
  /** Ne prati preusmerenja (rute koje vraćaju 302). */
  noRedirect?: boolean;
}

/** Folder u kolekciji (jedan domen, kao tag u Swagger-u). */
export interface ScenarioFolder {
  name: string;
  description: string;
  items: ScenarioRequest[];
}

// =============================================================================
// 2. Scenario: redosled poziva (newman ih izvršava odozgo nadole)
// =============================================================================

/** Lozinka demo naloga iz supabase/seed.sql. */
const DEMO_PASSWORD = "Lozinka123!";

/** ID koji ne postoji (za primer greške 404). */
const MISSING_ID = "00000000-0000-4000-8000-0000000000ff";

/** Prijava demo naloga; token i ID se čuvaju za ostale pozive. */
function login(name: string, email: string, role: "customer" | "agent" | "admin"): ScenarioRequest {
  return {
    name,
    operation: "POST /api/auth/login",
    role: "guest",
    body: { email, password: DEMO_PASSWORD },
    status: 200,
    save: { [`${role}Token`]: "session.accessToken", [`${role}Id`]: "profile.id" },
    checks: [
      `pm.test("Uloga je ${role}", () => pm.expect(pm.response.json().profile.role).to.eql("${role}"));`,
    ],
  };
}

export const SCENARIO: ScenarioFolder[] = [
  {
    name: "1. Prijava (Auth)",
    description:
      "Prijava kao korisnik (Ana), agent (Jelena) i admin. Token iz odgovora se čuva u " +
      "promenljivama kolekcije, pa ostali pozivi rade odmah. Uz to primeri grešaka prijave.",
    items: [
      login("Prijava kao korisnik (Ana)", "ana@helpdesk.test", "customer"),
      login("Prijava kao agent (Jelena)", "agent@helpdesk.test", "agent"),
      login("Prijava kao admin", "admin@helpdesk.test", "admin"),
      {
        name: "Pogrešna lozinka -> 401",
        operation: "POST /api/auth/login",
        role: "guest",
        body: { email: "ana@helpdesk.test", password: "PogresnaLozinka1!" },
        status: 401,
        errorCode: "INVALID_CREDENTIALS",
      },
      {
        name: "Neispravan email -> 400",
        operation: "POST /api/auth/login",
        role: "guest",
        body: { email: "nije-email", password: DEMO_PASSWORD },
        status: 400,
        errorCode: "VALIDATION_ERROR",
      },
      {
        name: "Registracija novog korisnika",
        operation: "POST /api/auth/register",
        role: "guest",
        body: {
          fullName: "Postman Test",
          email: "postman-{{$timestamp}}{{$randomInt}}@helpdesk.test",
          password: DEMO_PASSWORD,
        },
        status: 201,
      },
      {
        name: "Zaboravljena lozinka (šalje email)",
        operation: "POST /api/auth/password/forgot",
        role: "guest",
        body: { email: "ana@helpdesk.test" },
        status: 204,
      },
      {
        name: "Nova lozinka bez prijave -> 401",
        operation: "POST /api/auth/password/reset",
        role: "guest",
        body: { password: "NovaLozinka123!" },
        status: 401,
        errorCode: "UNAUTHENTICATED",
      },
      {
        name: "Nova lozinka prekratka -> 400",
        operation: "POST /api/auth/password/reset",
        role: "customer",
        body: { password: "kratka" },
        status: 400,
        errorCode: "VALIDATION_ERROR",
      },
      {
        name: "Google prijava preusmerava",
        operation: "GET /api/auth/google",
        role: "guest",
        status: 302,
        noRedirect: true,
        checks: [
          `pm.test("Ima adresu preusmerenja", () => pm.response.to.have.header("Location"));`,
        ],
      },
      {
        name: "Callback bez koda vraća na prijavu",
        operation: "GET /api/auth/callback",
        role: "guest",
        status: 302,
        noRedirect: true,
        checks: [
          `pm.test("Preusmerava na /login sa greškom", () => pm.expect(pm.response.headers.get("Location")).to.include("/login"));`,
        ],
      },
    ],
  },
  {
    name: "2. Profil",
    description: "Profil prijavljenog korisnika.",
    items: [
      { name: "Moj profil (korisnik)", operation: "GET /api/me", role: "customer", status: 200 },
      {
        name: "Profil bez prijave -> 401",
        operation: "GET /api/me",
        role: "guest",
        status: 401,
        errorCode: "UNAUTHENTICATED",
      },
      {
        name: "Izmena profila (jezik)",
        operation: "PATCH /api/me",
        role: "customer",
        body: { locale: "sr" },
        status: 200,
      },
    ],
  },
  {
    name: "3. Zahtevi (Tickets)",
    description:
      "Ceo život jednog zahteva: korisnik ga prijavi, agent preuzme, odgovori, doda internu " +
      "belešku i označi kao rešen, korisnik oceni. Uz to primeri zabrana (RBAC).",
    items: [
      {
        name: "Kategorije (za novi zahtev)",
        operation: "GET /api/categories",
        role: "customer",
        status: 200,
        save: { categoryId: "0.id" },
      },
      {
        name: "Korisnik prijavljuje zahtev",
        operation: "POST /api/tickets",
        role: "customer",
        body: {
          title: "Postman: ne radi VPN",
          description: "Od jutros VPN javlja grešku pri povezivanju.",
          categoryId: "{{categoryId}}",
          priority: "high",
        },
        status: 201,
        save: { ticketId: "id" },
        checks: [
          `pm.test("Novi zahtev je otvoren", () => pm.expect(pm.response.json().status).to.eql("open"));`,
        ],
      },
      {
        name: "Agent ne prijavljuje zahteve -> 403",
        operation: "POST /api/tickets",
        role: "agent",
        body: { title: "Agent", description: "Agent ne sme.", categoryId: "{{categoryId}}" },
        status: 403,
        errorCode: "FORBIDDEN",
      },
      {
        name: "Prazan naslov -> 400",
        operation: "POST /api/tickets",
        role: "customer",
        body: { title: "", description: "Opis.", categoryId: "{{categoryId}}" },
        status: 400,
        errorCode: "VALIDATION_ERROR",
      },
      { name: "Lista mojih zahteva", operation: "GET /api/tickets", role: "customer", status: 200 },
      {
        name: "Lista bez prijave -> 401",
        operation: "GET /api/tickets",
        role: "guest",
        status: 401,
        errorCode: "UNAUTHENTICATED",
      },
      {
        name: "Detalji zahteva",
        operation: "GET /api/tickets/{id}",
        url: "/api/tickets/{{ticketId}}",
        role: "customer",
        status: 200,
        checks: [
          `pm.test("Korisnik sme da menja svoj otvoren zahtev", () => pm.expect(pm.response.json().permissions.canEdit).to.eql(true));`,
        ],
      },
      {
        name: "Nepostojeći zahtev -> 404",
        operation: "GET /api/tickets/{id}",
        url: `/api/tickets/${MISSING_ID}`,
        role: "customer",
        status: 404,
        errorCode: "TICKET_NOT_FOUND",
      },
      {
        name: "Korisnik menja naslov",
        operation: "PATCH /api/tickets/{id}",
        url: "/api/tickets/{{ticketId}}",
        role: "customer",
        body: { title: "Postman: ne radi VPN na laptopu" },
        status: 200,
      },
      { name: "Tim podrške (za dodelu)", operation: "GET /api/agents", role: "agent", status: 200 },
      {
        name: "Agent preuzima zahtev",
        operation: "POST /api/tickets/{id}/assign",
        url: "/api/tickets/{{ticketId}}/assign",
        role: "agent",
        body: { assigneeId: "{{agentId}}" },
        status: 200,
        checks: [
          `pm.test("Zahtev je dodeljen agentu", () => pm.expect(pm.response.json().assignedTo).to.eql(pm.collectionVariables.get("agentId")));`,
        ],
      },
      {
        name: "Agent odgovara korisniku",
        operation: "POST /api/tickets/{id}/comments",
        url: "/api/tickets/{{ticketId}}/comments",
        role: "agent",
        body: { body: "Da li ste probali ponovo da pokrenete VPN klijent?" },
        status: 201,
      },
      {
        name: "Agent dodaje internu belešku",
        operation: "POST /api/tickets/{id}/comments",
        url: "/api/tickets/{{ticketId}}/comments",
        role: "agent",
        body: { body: "Interno: proveriti sertifikat na VPN serveru.", isInternal: true },
        status: 201,
      },
      {
        name: "Korisnik ne piše interne beleške -> 403",
        operation: "POST /api/tickets/{id}/comments",
        url: "/api/tickets/{{ticketId}}/comments",
        role: "customer",
        body: { body: "Pokušaj interne beleške.", isInternal: true },
        status: 403,
        errorCode: "FORBIDDEN_INTERNAL_COMMENT",
      },
      {
        name: "Korisnik ne vidi interne beleške",
        operation: "GET /api/tickets/{id}/comments",
        url: "/api/tickets/{{ticketId}}/comments",
        role: "customer",
        status: 200,
        checks: [
          `pm.test("Nijedan komentar nije interni", () => pm.expect(pm.response.json().filter((c) => c.isInternal)).to.have.length(0));`,
        ],
      },
      {
        name: "Agent vidi i interne beleške",
        operation: "GET /api/tickets/{id}/comments",
        url: "/api/tickets/{{ticketId}}/comments",
        role: "agent",
        status: 200,
        checks: [
          `pm.test("Interna beleška je u listi", () => pm.expect(pm.response.json().some((c) => c.isInternal)).to.eql(true));`,
        ],
      },
      {
        name: "Agent ne zatvara zahtev u obradi -> 409",
        operation: "POST /api/tickets/{id}/status",
        url: "/api/tickets/{{ticketId}}/status",
        role: "agent",
        body: { status: "closed" },
        status: 409,
        errorCode: "INVALID_STATUS_TRANSITION",
      },
      {
        name: "Agent označava zahtev kao rešen",
        operation: "POST /api/tickets/{id}/status",
        url: "/api/tickets/{{ticketId}}/status",
        role: "agent",
        body: { status: "resolved" },
        status: 200,
        checks: [
          `pm.test("Status je rešen", () => pm.expect(pm.response.json().status).to.eql("resolved"));`,
        ],
      },
      {
        name: "Korisnik ocenjuje rešenje (CSAT)",
        operation: "POST /api/tickets/{id}/rating",
        url: "/api/tickets/{{ticketId}}/rating",
        role: "customer",
        body: { score: 5, comment: "Brzo i ljubazno, hvala!" },
        status: 201,
      },
      {
        name: "Druga ocena istog zahteva -> 409",
        operation: "POST /api/tickets/{id}/rating",
        url: "/api/tickets/{{ticketId}}/rating",
        role: "customer",
        body: { score: 1 },
        status: 409,
        errorCode: "ALREADY_RATED",
      },
      {
        name: "Istorija promena",
        operation: "GET /api/tickets/{id}/history",
        url: "/api/tickets/{{ticketId}}/history",
        role: "customer",
        status: 200,
        checks: [
          `pm.test("Istorija nije prazna", () => pm.expect(pm.response.json().length).to.be.above(0));`,
        ],
      },
    ],
  },
  {
    name: "4. Obaveštenja",
    description: "Obaveštenja koja je korisnik dobio dok je agent radio na zahtevu.",
    items: [
      {
        name: "Lista obaveštenja",
        operation: "GET /api/notifications",
        role: "customer",
        status: 200,
        save: { notificationId: "items.0.id" },
      },
      {
        name: "Označi jedno kao pročitano",
        operation: "POST /api/notifications/{id}/read",
        url: "/api/notifications/{{notificationId}}/read",
        role: "customer",
        status: 204,
      },
      {
        name: "Označi sva kao pročitana",
        operation: "POST /api/notifications/read-all",
        role: "customer",
        status: 204,
      },
    ],
  },
  {
    name: "5. Kontrolni panel",
    description: "Isti poziv daje drugačiji panel za svaku ulogu (polje kind).",
    items: (["customer", "agent", "admin"] as const).map((role) => ({
      name: `Panel (${role})`,
      operation: "GET /api/dashboard",
      role,
      status: 200,
      checks: [
        `pm.test("Panel je za ulogu ${role}", () => pm.expect(pm.response.json().kind).to.eql("${role}"));`,
      ],
    })),
  },
  {
    name: "6. Analitika",
    description: "Analitika rada tima (samo admin) i primeri zabrane i lošeg perioda.",
    items: [
      {
        name: "Pregled (admin)",
        operation: "GET /api/analytics/overview",
        role: "admin",
        status: 200,
      },
      {
        name: "Po kategoriji (admin)",
        operation: "GET /api/analytics/by-dimension",
        url: "/api/analytics/by-dimension?dimension=category",
        role: "admin",
        status: 200,
      },
      {
        name: "Po agentu (admin)",
        operation: "GET /api/analytics/agents",
        role: "admin",
        status: 200,
      },
      {
        name: "Trend po nedeljama (admin)",
        operation: "GET /api/analytics/trend",
        url: "/api/analytics/trend?bucket=week",
        role: "admin",
        status: 200,
      },
      {
        name: "Agent ne vidi analitiku -> 403",
        operation: "GET /api/analytics/overview",
        role: "agent",
        status: 403,
        errorCode: "FORBIDDEN",
      },
      {
        name: "Period obrnut (od posle do) -> 400",
        operation: "GET /api/analytics/overview",
        url: "/api/analytics/overview?from=2026-10-21&to=2026-10-01",
        role: "admin",
        status: 400,
        errorCode: "VALIDATION_ERROR",
      },
    ],
  },
  {
    name: "7. Administracija",
    description: "Nalozi i kategorije (samo admin) i primeri zabrana.",
    items: [
      {
        name: "Pretraga naloga (admin)",
        operation: "GET /api/admin/users",
        url: "/api/admin/users?q=marko",
        role: "admin",
        status: 200,
        save: { markoId: "items.0.id" },
      },
      {
        name: "Korisnik ne vidi administraciju -> 403",
        operation: "GET /api/admin/users",
        role: "customer",
        status: 403,
        errorCode: "FORBIDDEN",
      },
      {
        name: "Admin potvrđuje da je nalog aktivan",
        operation: "PATCH /api/admin/users/{id}",
        url: "/api/admin/users/{{markoId}}",
        role: "admin",
        body: { isActive: true },
        status: 200,
      },
      {
        name: "Admin ne menja sopstveni nalog -> 409",
        operation: "PATCH /api/admin/users/{id}",
        url: "/api/admin/users/{{adminId}}",
        role: "admin",
        body: { role: "agent" },
        status: 409,
        errorCode: "CANNOT_MODIFY_SELF",
      },
      {
        name: "Nova kategorija",
        operation: "POST /api/admin/categories",
        role: "admin",
        body: {
          slug: "postman-{{$timestamp}}",
          nameEn: "Postman test",
          nameSr: "Postman test",
        },
        status: 201,
        save: { newCategoryId: "id", newCategorySlug: "slug" },
      },
      {
        name: "Ista oznaka kategorije -> 409",
        operation: "POST /api/admin/categories",
        role: "admin",
        body: { slug: "{{newCategorySlug}}", nameEn: "Duplikat", nameSr: "Duplikat" },
        status: 409,
        errorCode: "CATEGORY_SLUG_TAKEN",
      },
      {
        name: "Deaktivacija kategorije",
        operation: "PATCH /api/admin/categories/{id}",
        url: "/api/admin/categories/{{newCategoryId}}",
        role: "admin",
        body: { isActive: false },
        status: 200,
      },
    ],
  },
  {
    name: "8. Sistem i odjava",
    description:
      "OpenAPI specifikacija i odjava. Odjava ide na kraju, sa posebnom prijavom, da ne " +
      "poništi token koji koriste ostali pozivi.",
    items: [
      { name: "OpenAPI specifikacija", operation: "GET /api/openapi", role: "guest", status: 200 },
      {
        ...login("Prijava za odjavu (Ana)", "ana@helpdesk.test", "customer"),
        save: { logoutToken: "session.accessToken" },
        checks: [],
      },
      { name: "Odjava", operation: "POST /api/auth/logout", role: "logout", status: 204 },
    ],
  },
];

// =============================================================================
// 3. OpenAPI -> JSON Schema (za pm.response.to.have.jsonSchema)
// =============================================================================

/** Ključevi koji opisuju šemu za ljude ili su samo OpenAPI, a ne utiču na proveru. */
const DROPPED_KEYS = new Set([
  "example",
  "examples",
  "description",
  "discriminator",
  "format",
  "pattern",
]);

/**
 * Pretvara OpenAPI 3.0 šemu u JSON Schemu koju razume Postman:
 *   - $ref na components/schemas se zamenjuje samom šemom
 *   - nullable: true postaje „ta šema ILI null“
 *   - opisi, primeri, format i pattern se izbacuju (proverava se oblik odgovora;
 *     Postman ne zna sve formate, a Zod regex nije uvek ispravan JSON Schema pattern)
 * Ulaz: šema i ceo dokument (zbog $ref). Vraća: novu šemu (ulaz se ne menja).
 */
export function toJsonSchema(schema: Schema, doc: OpenApiDocument): Schema {
  // Korak 1: referenca na zajedničku šemu.
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.replace("#/components/schemas/", "");
    const target = doc.components?.schemas?.[name];
    if (!target) throw new Error(`Nepoznata šema ${schema.$ref}`);
    return toJsonSchema(target, doc);
  }

  // Korak 2: prepis ključeva, rekurzivno za ugnježdene šeme.
  const result: Schema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (DROPPED_KEYS.has(key) || key === "nullable") continue;
    if (key === "properties" && value && typeof value === "object") {
      result.properties = Object.fromEntries(
        Object.entries(value as Record<string, Schema>).map(([prop, sub]) => [
          prop,
          toJsonSchema(sub, doc),
        ]),
      );
    } else if ((key === "items" || key === "additionalProperties") && isSchema(value)) {
      result[key] = toJsonSchema(value, doc);
    } else if ((key === "anyOf" || key === "oneOf" || key === "allOf") && Array.isArray(value)) {
      result[key] = (value as Schema[]).map((sub) => toJsonSchema(sub, doc));
    } else {
      result[key] = value;
    }
  }

  // Korak 3: nullable.
  return schema.nullable === true ? { anyOf: [result, { type: "null" }] } : result;
}

/** Da li je vrednost objekat šeme (a ne true/false). */
function isSchema(value: unknown): value is Schema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// =============================================================================
// 4. Provera usklađenosti scenarija i specifikacije
// =============================================================================

/**
 * Upoređuje rute iz OpenAPI-ja i scenarija.
 * Vraća: { missing: rute bez Postman poziva, unknown: pozive bez rute u OpenAPI-ju }.
 */
export function compareCoverage(
  doc: OpenApiDocument,
  scenario: ScenarioFolder[],
): { missing: string[]; unknown: string[] } {
  const inSpec = new Set(
    Object.entries(doc.paths).flatMap(([path, ops]) =>
      Object.keys(ops).map((method) => `${method.toUpperCase()} ${path}`),
    ),
  );
  const inScenario = new Set(
    scenario.flatMap((folder) => folder.items.map((item) => item.operation)),
  );
  return {
    missing: [...inSpec].filter((op) => !inScenario.has(op)).sort(),
    unknown: [...inScenario].filter((op) => !inSpec.has(op)).sort(),
  };
}

// =============================================================================
// 5. Pravljenje Postman kolekcije (format v2.1)
// =============================================================================

/** Token koji se šalje za ulogu (Postman promenljiva). */
const TOKEN_VARIABLE: Record<Exclude<Role, "guest">, string> = {
  customer: "customerToken",
  agent: "agentToken",
  admin: "adminToken",
  logout: "logoutToken",
};

/** Promenljive kolekcije koje pozivi popunjavaju (na početku prazne). */
const COLLECTION_VARIABLES = [
  "customerToken",
  "customerId",
  "agentToken",
  "agentId",
  "adminToken",
  "adminId",
  "logoutToken",
  "categoryId",
  "ticketId",
  "notificationId",
  "markoId",
  "newCategoryId",
  "newCategorySlug",
];

/**
 * Postman testovi za jedan poziv (JavaScript linije):
 * status, šema odgovora ili oblik greške, čuvanje promenljivih, dodatne provere.
 */
export function buildTests(
  item: ScenarioRequest,
  operation: OpenApiOperation,
  doc: OpenApiDocument,
): string[] {
  const lines = [
    `pm.test("Status ${item.status}", () => pm.response.to.have.status(${item.status}));`,
  ];

  // Korak 1: uspešan odgovor -> JSON šema iz OpenAPI-ja (ako ruta vraća JSON).
  const schema = operation.responses[String(item.status)]?.content?.["application/json"]?.schema;
  if (item.status < 400 && schema) {
    const jsonSchema = JSON.stringify(toJsonSchema(schema, doc));
    lines.push(
      `pm.test("Odgovor odgovara šemi iz OpenAPI-ja", () => pm.response.to.have.jsonSchema(${jsonSchema}));`,
    );
  }

  // Korak 2: greška -> jedinstven oblik { error: { code, message } } i očekivani kod.
  if (item.status >= 400) {
    lines.push(
      "const error = pm.response.json().error;",
      `pm.test("Greška ima oblik { error: { code, message } }", () => {`,
      `  pm.expect(error.code).to.be.a("string");`,
      `  pm.expect(error.message).to.be.a("string");`,
      "});",
    );
    if (item.errorCode) {
      lines.push(
        `pm.test("Kod greške ${item.errorCode}", () => pm.expect(error.code).to.eql("${item.errorCode}"));`,
      );
    }
  }

  // Korak 3: čuvanje vrednosti iz odgovora za sledeće pozive.
  for (const [variable, path] of Object.entries(item.save ?? {})) {
    const access = path
      .split(".")
      .map((part) => (/^\d+$/.test(part) ? `[${part}]` : `.${part}`))
      .join("");
    lines.push(`pm.collectionVariables.set("${variable}", pm.response.json()${access});`);
  }

  return [...lines, ...(item.checks ?? [])];
}

/** Jedan Postman poziv iz stavke scenarija. */
function buildRequest(item: ScenarioRequest, doc: OpenApiDocument): Schema {
  // Korak 1: operacija iz OpenAPI-ja (opis i šeme).
  const [method = "", path = ""] = item.operation.split(" ");
  const operation = doc.paths[path]?.[method.toLowerCase()];
  if (!operation) throw new Error(`Operacija ${item.operation} ne postoji u OpenAPI-ju.`);

  // Korak 2: adresa sa promenljivom {{baseUrl}} iz okruženja.
  const raw = `{{baseUrl}}${item.url ?? path}`;
  const [pathPart = "", queryPart] = raw.split("?");
  const url: Schema = {
    raw,
    host: ["{{baseUrl}}"],
    path: pathPart.replace("{{baseUrl}}/", "").split("/"),
  };
  if (queryPart) {
    url.query = queryPart.split("&").map((pair) => {
      const [key, value] = pair.split("=");
      return { key, value };
    });
  }

  // Korak 3: prijava (Bearer token uloge) i telo.
  const auth =
    item.role === "guest"
      ? { type: "noauth" }
      : {
          type: "bearer",
          bearer: [{ key: "token", value: `{{${TOKEN_VARIABLE[item.role]}}}`, type: "string" }],
        };
  const request: Schema = {
    method,
    auth,
    header: item.body === undefined ? [] : [{ key: "Content-Type", value: "application/json" }],
    url,
    description: [operation.summary, operation.description].filter(Boolean).join("\n\n"),
  };
  if (item.body !== undefined) {
    request.body = {
      mode: "raw",
      raw: JSON.stringify(item.body, null, 2),
      options: { raw: { language: "json" } },
    };
  }

  // Korak 4: testovi posle odgovora.
  const result: Schema = {
    name: item.name,
    event: [
      {
        listen: "test",
        script: { type: "text/javascript", exec: buildTests(item, operation, doc) },
      },
    ],
    request,
  };
  // Kolačići se ne šalju: prijava ide samo preko Bearer tokena, kao u Swagger-u.
  // Inače bi kolačić sesije iz poziva za prijavu „prijavio“ i pozive kao gost.
  result.protocolProfileBehavior = item.noRedirect
    ? { disableCookies: true, followRedirects: false }
    : { disableCookies: true };
  return result;
}

/** Cela kolekcija (deterministička: isti ulaz daje isti JSON, pa radi --check). */
export function buildCollection(
  doc: OpenApiDocument,
  scenario: ScenarioFolder[] = SCENARIO,
): Schema {
  return {
    info: {
      name: "Tehnička podrška — API",
      description:
        "Postman kolekcija za API veb aplikacije za tehničku podršku (diplomski rad, Milutin " +
        "Petrović 3407). Generisana iz OpenAPI specifikacije skriptom `pnpm postman:generate` " +
        "(scripts/postman-generate.mts); ne menjati ručno. Izaberite okruženje (local ili demo) " +
        "i pokrenite celu kolekciju (Run collection): pozivi idu redom, prvo prijava.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: { type: "noauth" },
    variable: COLLECTION_VARIABLES.map((key) => ({ key, value: "" })),
    item: scenario.map((folder) => ({
      name: folder.name,
      description: folder.description,
      item: folder.items.map((item) => buildRequest(item, doc)),
    })),
  };
}

// =============================================================================
// 6. Pokretanje iz komandne linije
// =============================================================================

/** Gde se upisuje kolekcija. */
const OUTPUT = new URL("../postman/helpdesk.postman_collection.json", import.meta.url);

/** Učita specifikaciju, proveri pokrivenost, upiše (ili uporedi) kolekciju. */
async function main(): Promise<void> {
  // Korak 1: OpenAPI iz pokrenute aplikacije.
  const specUrl = process.env.OPENAPI_URL ?? "http://localhost:3000/api/openapi";
  const response = await fetch(specUrl);
  if (!response.ok)
    throw new Error(`${specUrl} je vratio ${response.status}. Da li aplikacija radi?`);
  const doc = (await response.json()) as OpenApiDocument;

  // Korak 2: svaka ruta mora imati Postman poziv i obrnuto.
  const { missing, unknown } = compareCoverage(doc, SCENARIO);
  if (missing.length > 0 || unknown.length > 0) {
    if (missing.length > 0) console.error(`Rute bez Postman poziva:\n  ${missing.join("\n  ")}`);
    if (unknown.length > 0)
      console.error(`Pozivi bez rute u OpenAPI-ju:\n  ${unknown.join("\n  ")}`);
    process.exit(1);
  }

  // Korak 3: upis ili provera da je upisana kolekcija ažurna.
  const json = `${JSON.stringify(buildCollection(doc), null, 2)}\n`;
  if (process.argv.includes("--check")) {
    const current = await readFile(OUTPUT, "utf8").catch(() => "");
    if (current !== json) {
      console.error(
        "Postman kolekcija nije ažurna. Pokrenite `pnpm postman:generate` i sačuvajte izmenu.",
      );
      process.exit(1);
    }
    console.log("Postman kolekcija je ažurna.");
    return;
  }
  await writeFile(OUTPUT, json);
  const count = SCENARIO.reduce((sum, folder) => sum + folder.items.length, 0);
  console.log(
    `Postman kolekcija: ${count} poziva za ${Object.keys(doc.paths).length} putanja -> postman/`,
  );
}

// Pokreće se samo kad se fajl izvrši direktno (ne kad ga uvozi unit test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
