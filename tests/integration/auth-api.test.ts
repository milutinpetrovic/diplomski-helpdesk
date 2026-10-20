/**
 * Integracioni testovi: API rute za prijavu i profil (Faza 4), nad pravim
 * lokalnim Supabase-om, uključujući prave emailove iz Mailpit-a.
 *
 * Proverava UC-01 (registracija i potvrda emaila), UC-02 (prijava), UC-03
 * (početak Google prijave), UC-04 (reset lozinke), UC-05 (odjava) i UC-06
 * (profil): API rute -> AuthService/ProfileService -> Supabase Auth -> baza.
 *
 * Rute se pozivaju direktno (kao funkcije), bez pokretanja Next.js servera.
 * Kolačiće (sesija, jezik) inače daje Next.js preko next/headers; ovde ih
 * zamenjuje mala „tegla kolačića“ (cookieJar), kao pregledač.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as forgotPassword } from "@/app/api/auth/password/forgot/route";
import { POST as resetPassword } from "@/app/api/auth/password/reset/route";
import { GET as callback } from "@/app/api/auth/callback/route";
import { GET as google } from "@/app/api/auth/google/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as getMe, PATCH as patchMe } from "@/app/api/me/route";
import type { RouteHandler } from "@/lib/api/with-api";
import { as, SEED_PASSWORD, USERS } from "./helpers";

// Kolačići „pregledača“: next/headers cookies() čita i piše ovde.
const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      // Supabase briše kolačić tako što ga upiše prazan, sa maxAge 0.
      if (value === "" || options?.maxAge === 0) cookieJar.delete(name);
      else cookieJar.set(name, value);
    },
  }),
}));

/** Adresa aplikacije u testu (od nje se prave linkovi u emailovima i preusmerenja). */
const APP = "http://localhost:3000";
/** Mailpit (lokalni „poštanski sandučić“ koji pokreće supabase start). */
const MAILPIT = process.env.INBUCKET_URL ?? process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Poziva API rutu kao pregledač: JSON telo, jezik i opcioni Bearer token. */
function call(
  route: RouteHandler,
  path: string,
  { method = "POST", body, token, locale = "sr" }: CallOptions = {},
) {
  const headers: Record<string, string> = { "Accept-Language": locale };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const request = new Request(APP + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return route(request, { params: Promise.resolve({}) });
}

interface CallOptions {
  method?: string;
  body?: unknown;
  token?: string;
  locale?: "sr" | "en";
}

/** Kod greške iz odgovora { error: { code } }. */
async function errorCode(response: Response): Promise<string> {
  return (await response.json()).error.code;
}

/** Da li u „pregledaču“ postoji kolačić Supabase sesije (sb-...-auth-token). */
function hasSessionCookie(): boolean {
  return [...cookieJar.keys()].some(
    (name) => name.startsWith("sb-") && name.includes("auth-token"),
  );
}

/**
 * Čeka email za datu adresu u Mailpit-u i vraća token_hash iz linka.
 * Ulaz: email i vrsta linka ("email" = potvrda naloga, "recovery" = nova lozinka).
 */
async function tokenHashFromEmail(email: string, type: "email" | "recovery"): Promise<string> {
  const query = encodeURIComponent(`to:"${email}"`);
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = (await (await fetch(`${MAILPIT}/api/v1/search?query=${query}`)).json()) as {
      messages?: { ID: string }[];
    };
    for (const { ID } of search.messages ?? []) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${ID}`)).json()) as {
        HTML: string;
      };
      // U HTML-u je & zapisan kao &amp;.
      const html = message.HTML.replaceAll("&amp;", "&");
      const match = /token_hash=([^&"]+)&type=(\w+)/.exec(html);
      if (match?.[1] && match[2] === type) return match[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Email (${type}) za ${email} nije stigao u Mailpit.`);
}

beforeEach(() => {
  cookieJar.clear();
});

describe("registracija, potvrda emaila, prijava, reset lozinke i odjava (nov nalog)", () => {
  // Jedinstven email za svako pokretanje testova.
  const email = `test-${Date.now()}@helpdesk.test`;
  const password = "Proba1234";
  const newPassword = "NovaLozinka456";

  it("registracija pravi nalog sa ulogom customer i jezikom iz interfejsa", async () => {
    const response = await call(register, "/api/auth/register", {
      body: { fullName: "Test Korisnik", email, password },
      locale: "en",
    });
    expect(response.status).toBe(201);

    // Profil je napravio triger handle_new_user; admin vidi sve profile.
    const admin = await as("admin");
    const { data } = await admin
      .from("profiles")
      .select("role, locale, full_name")
      .eq("email", email)
      .single();
    expect(data).toEqual({ role: "customer", locale: "en", full_name: "Test Korisnik" });
  });

  it("prijava pre potvrde emaila vraća 403 EMAIL_NOT_CONFIRMED", async () => {
    const response = await call(login, "/api/auth/login", { body: { email, password } });
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("EMAIL_NOT_CONFIRMED");
  });

  it("link iz emaila potvrđuje nalog, prijavljuje korisnika i vodi na /dashboard", async () => {
    const tokenHash = await tokenHashFromEmail(email, "email");
    const response = await call(
      callback,
      `/api/auth/callback?token_hash=${tokenHash}&type=email&next=/dashboard`,
      { method: "GET" },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${APP}/dashboard`);
    expect(hasSessionCookie()).toBe(true);
    // Jezik iz profila prelazi u kolačić interfejsa.
    expect(cookieJar.get("NEXT_LOCALE")).toBe("en");
  });

  it("registracija sa emailom potvrđenog naloga vraća 409 EMAIL_ALREADY_REGISTERED", async () => {
    const response = await call(register, "/api/auth/register", {
      body: { fullName: "Drugi Pokušaj", email, password },
    });
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("posle potvrde prijava radi i postavlja kolačiće sesije", async () => {
    const response = await call(login, "/api/auth/login", { body: { email, password } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile).toMatchObject({ email, role: "customer", fullName: "Test Korisnik" });
    expect(body.session.accessToken).toEqual(expect.any(String));
    expect(hasSessionCookie()).toBe(true);

    // Sesija iz kolačića važi i za ostale API rute (GET /api/me bez Bearer tokena).
    const me = await call(getMe, "/api/me", { method: "GET" });
    expect(me.status).toBe(200);
    expect((await me.json()).email).toBe(email);
  });

  it("reset lozinke: email -> link -> nova lozinka -> prijava novom lozinkom", async () => {
    // Supabase ne šalje dva emaila istoj adresi brže od 1 s (max_frequency).
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const forgot = await call(forgotPassword, "/api/auth/password/forgot", { body: { email } });
    expect(forgot.status).toBe(204);

    // Link iz emaila: privremena sesija i preusmerenje na /reset-password.
    const tokenHash = await tokenHashFromEmail(email, "recovery");
    const back = await call(
      callback,
      `/api/auth/callback?token_hash=${tokenHash}&type=recovery&next=/reset-password`,
      { method: "GET" },
    );
    expect(back.headers.get("location")).toBe(`${APP}/reset-password`);

    // Nova lozinka sa sesijom iz kolačića.
    const reset = await call(resetPassword, "/api/auth/password/reset", {
      body: { password: newPassword },
    });
    expect(reset.status).toBe(204);

    // Stara lozinka više ne važi, nova važi.
    cookieJar.clear();
    const oldLogin = await call(login, "/api/auth/login", { body: { email, password } });
    expect(oldLogin.status).toBe(401);
    const newLogin = await call(login, "/api/auth/login", {
      body: { email, password: newPassword },
    });
    expect(newLogin.status).toBe(200);
  });

  it("odjava briše sesiju; posle toga /api/me vraća 401", async () => {
    await call(login, "/api/auth/login", { body: { email, password: newPassword } });
    expect(hasSessionCookie()).toBe(true);

    const response = await call(logout, "/api/auth/logout");
    expect(response.status).toBe(204);
    expect(hasSessionCookie()).toBe(false);

    const me = await call(getMe, "/api/me", { method: "GET" });
    expect(me.status).toBe(401);
  });
});

describe("prijava i profil demo naloga", () => {
  /** Pristupni token demo naloga (kao „Authorize“ u Swagger-u). */
  async function anaToken(): Promise<string> {
    const response = await call(login, "/api/auth/login", {
      body: { email: USERS.ana.email, password: SEED_PASSWORD },
    });
    return (await response.json()).session.accessToken;
  }

  it("pogrešna lozinka vraća 401 INVALID_CREDENTIALS", async () => {
    const response = await call(login, "/api/auth/login", {
      body: { email: USERS.ana.email, password: "pogresna-lozinka1" },
    });
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("INVALID_CREDENTIALS");
  });

  it("neispravan email vraća 400 sa greškom polja", async () => {
    const response = await call(login, "/api/auth/login", {
      body: { email: "nije-email", password: "x" },
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.details.fields.email).toEqual(["emailInvalid"]);
  });

  it("GET /api/me sa Bearer tokenom vraća sopstveni profil", async () => {
    const response = await call(getMe, "/api/me", { method: "GET", token: await anaToken() });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: USERS.ana.id,
      email: USERS.ana.email,
      role: "customer",
    });
  });

  it("PATCH /api/me menja ime i jezik", async () => {
    const token = await anaToken();
    const before = await (await call(getMe, "/api/me", { method: "GET", token })).json();

    const response = await call(patchMe, "/api/me", {
      method: "PATCH",
      token,
      body: { fullName: "Ana Izmenjena", locale: "en" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ fullName: "Ana Izmenjena", locale: "en" });

    // Vraćamo prethodne vrednosti (drugi testovi koriste isti nalog).
    await call(patchMe, "/api/me", {
      method: "PATCH",
      token,
      body: { fullName: before.fullName, locale: before.locale },
    });
  });

  it("korisnik ne može sebi da promeni ulogu (400, polje nije dozvoljeno)", async () => {
    const response = await call(patchMe, "/api/me", {
      method: "PATCH",
      token: await anaToken(),
      body: { role: "admin" },
    });
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("VALIDATION_ERROR");
  });

  it("nova lozinka ista kao stara (Bearer token) vraća 400 passwordSame", async () => {
    const response = await call(resetPassword, "/api/auth/password/reset", {
      token: await anaToken(),
      body: { password: SEED_PASSWORD },
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.details.fields.password).toEqual(["passwordSame"]);
  });

  it("zaboravljena lozinka za nepostojeći email vraća 204 (ne otkriva da nalog ne postoji)", async () => {
    const response = await call(forgotPassword, "/api/auth/password/forgot", {
      body: { email: "niko-ne-postoji@helpdesk.test" },
    });
    expect(response.status).toBe(204);
  });

  it("bez prijave GET /api/me vraća 401", async () => {
    const response = await call(getMe, "/api/me", { method: "GET" });
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("UNAUTHENTICATED");
  });
});

describe("Google prijava i callback", () => {
  it("GET /api/auth/google preusmerava na Supabase/Google sa povratkom na callback", async () => {
    const response = await call(google, "/api/auth/google?next=/tickets", { method: "GET" });
    expect(response.status).toBe(302);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/auth/v1/authorize");
    expect(location.searchParams.get("provider")).toBe("google");
    expect(location.searchParams.get("redirect_to")).toBe(
      `${APP}/api/auth/callback?next=%2Ftickets`,
    );
    // PKCE: tajni „code verifier“ je sačuvan u kolačiću za korak callback.
    expect([...cookieJar.keys()].some((name) => name.includes("code-verifier"))).toBe(true);
  });

  it("next na tuđ sajt se ignoriše (zaštita od open redirect napada)", async () => {
    const response = await call(google, "/api/auth/google?next=//zli-sajt.com", { method: "GET" });
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("redirect_to")).toBe(
      `${APP}/api/auth/callback?next=%2Fdashboard`,
    );
  });

  it("neispravan link iz emaila vodi na /login?error=AUTH_CALLBACK_FAILED", async () => {
    const response = await call(
      callback,
      "/api/auth/callback?token_hash=nepostojeci&type=email&next=/dashboard",
      { method: "GET" },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${APP}/login?error=AUTH_CALLBACK_FAILED`);
  });

  it("odustajanje na Google-u vodi na /login sa greškom", async () => {
    const response = await call(callback, "/api/auth/callback?error=access_denied", {
      method: "GET",
    });
    expect(response.headers.get("location")).toBe(`${APP}/login?error=AUTH_CALLBACK_FAILED`);
  });
});
