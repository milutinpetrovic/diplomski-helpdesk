/**
 * Fajl: src/services/auth/auth-service.ts
 * Svrha: AuthService — sve što se tiče naloga i sesije: registracija (UC-01),
 * prijava emailom (UC-02), prijava Google nalogom (UC-03), reset lozinke
 * (UC-04) i odjava (UC-05). Jedini servis koji radi i bez prijavljenog
 * korisnika (gost), pa ne dobija ServiceContext nego samo Supabase klijent.
 * Koriste ga: API rute u src/app/api/auth/**.
 * Povezano sa: Supabase Auth (nalozi i sesije), triger handle_new_user u bazi
 * (pravi profil sa ulogom customer), ProfileService (readProfile),
 * docs/05 (SD-02 registracija, SD-03 Google prijava), docs/03 (klasa AuthService).
 *
 * Kako sesija stiže do pregledača: klijent napravljen sa @supabase/ssr posle
 * prijave sam upisuje kolačiće sesije u odgovor API rute.
 */
import { AppError } from "@/lib/errors/app-error";
import type { Locale } from "@/lib/i18n/config";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { DbClient } from "@/lib/supabase/types";
import type { CallbackQuery, LoginInput, RegisterInput } from "@/lib/validation/auth";
import type { Profile } from "@/lib/validation/profile";
import { mapAuthError, type AuthErrorLike } from "@/services/auth/auth-errors";
import { readProfile } from "@/services/profile/profile-service";

/** Putanja API rute na koju se vraćaju linkovi iz emaila i Google prijava. */
export const AUTH_CALLBACK_PATH = "/api/auth/callback";

/** Rezultat uspešne prijave: profil i pristupni token (za Swagger i Postman). */
export interface LoginResult {
  profile: Profile;
  session: {
    /** JWT za zaglavlje Authorization: Bearer (dugme „Authorize“ u Swagger-u). */
    accessToken: string;
    /** Kada token ističe (Unix vreme u sekundama). */
    expiresAt: number | null;
  };
}

/** Servis za naloge i sesije. Uloge: gost (registracija, prijava) i svi prijavljeni (odjava, nova lozinka). */
export class AuthService {
  /**
   * Ulaz: Supabase klijent (sa kolačićima zahteva, da bi mogao da upiše sesiju)
   * i adresa aplikacije (za linkove u emailovima i povratak sa Google-a).
   */
  constructor(
    private readonly db: DbClient,
    private readonly siteUrl: string,
  ) {}

  /**
   * Registracija emailom i lozinkom (UC-01).
   * Ulaz: ime, email, lozinka i jezik interfejsa (upisuje se u profil).
   * Supabase šalje email za potvrdu; nalog se ne može koristiti dok korisnik
   * ne klikne na link. Profil (uloga customer) pravi triger handle_new_user.
   * Baca: EMAIL_ALREADY_REGISTERED (409), VALIDATION_ERROR (400), RATE_LIMITED (429).
   */
  async register(input: RegisterInput, locale: Locale): Promise<void> {
    // Korak 1: nalog u Supabase Auth-u; ime i jezik idu u metapodatke, odakle ih čita triger.
    const { data, error } = await this.db.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.fullName, locale },
        emailRedirectTo: this.callbackUrl("/dashboard"),
      },
    });
    if (error) throw mapAuthError(error);

    // Korak 2: kad je potvrda emaila uključena, Supabase za postojeći email ne vraća
    // grešku nego korisnika bez identiteta (zaštita od otkrivanja naloga).
    // Mi to prijavljujemo kao EMAIL_ALREADY_REGISTERED, kako traži UC-01 (alternativni tok 4a).
    if (data.user && data.user.identities?.length === 0) {
      throw new AppError("EMAIL_ALREADY_REGISTERED");
    }
  }

  /**
   * Prijava emailom i lozinkom (UC-02).
   * Ulaz: email i lozinka; jezik koji je korisnik izabrao u interfejsu pre
   * prijave (kolačić), ili null ako ga nije birao.
   * Vraća: profil i pristupni token; kolačići sesije se upisuju u odgovor.
   * Baca: INVALID_CREDENTIALS (401), EMAIL_NOT_CONFIRMED (403), ACCOUNT_DISABLED (403).
   */
  async login(input: LoginInput, uiLocale: Locale | null): Promise<LoginResult> {
    // Korak 1: provera emaila i lozinke kod Supabase Auth-a.
    const { data, error } = await this.db.auth.signInWithPassword(input);
    if (error) throw mapAuthError(error);

    // Korak 2: profil mora biti vidljiv (deaktiviran nalog ga ne vidi) -> inače odjava i greška.
    const profile = await this.loadActiveProfile(data.user.id, uiLocale);

    // Korak 3: rezultat (token je isti kao u kolačiću; služi za Swagger i Postman).
    return {
      profile,
      session: {
        accessToken: data.session.access_token,
        expiresAt: data.session.expires_at ?? null,
      },
    };
  }

  /**
   * Odjava (UC-05): poništava sesiju kod Supabase-a i briše kolačiće.
   * Ulaz: token iz zaglavlja Authorization (Swagger/Postman), ili null kad se
   * odjavljuje aplikacija (sesija iz kolačića).
   */
  async logout(accessToken: string | null): Promise<void> {
    const { error } = accessToken
      ? await this.db.auth.admin.signOut(accessToken, "local")
      : await this.db.auth.signOut({ scope: "local" });
    if (error) throw mapAuthError(error);
  }

  /**
   * Prvi korak Google prijave (UC-03): pravi adresu Google stranice za prijavu.
   * Ulaz: putanja na koju se korisnik vraća posle prijave (npr. /dashboard).
   * Vraća: URL na koji API ruta preusmerava pregledač. Usput se u kolačić
   * upisuje tajni „code verifier“ (PKCE), koji callback kasnije proverava.
   */
  async getGoogleOAuthUrl(next: string): Promise<string> {
    const { data, error } = await this.db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: this.callbackUrl(next),
        skipBrowserRedirect: true,
        // Google uvek nudi izbor naloga (korisno kad je na računaru prijavljeno više naloga).
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw mapAuthError(error);
    return data.url;
  }

  /**
   * Završava prijavu kad se korisnik vrati na /api/auth/callback:
   *   - posle Google prijave stiže `code` -> menja se za sesiju (PKCE)
   *   - iz linka u emailu stižu `token_hash` i `type` (potvrda naloga ili reset lozinke)
   * Ako je Google email isti kao email postojećeg potvrđenog naloga, Supabase
   * sam vezuje Google za taj nalog (isti korisnik, isti profil i uloga).
   * Ulaz: query parametri i jezik iz interfejsa (kolačić) ili null.
   * Vraća: profil prijavljenog korisnika.
   * Baca: AUTH_CALLBACK_FAILED (link istekao, odustao na Google-u...), ACCOUNT_DISABLED.
   */
  async completeCallback(query: CallbackQuery, uiLocale: Locale | null): Promise<Profile> {
    // Korak 1: korisnik je odustao na Google-u ili je Supabase vratio grešku.
    if (query.error) throw new AppError("AUTH_CALLBACK_FAILED", { reason: query.error });

    // Korak 2: zamena koda ili tokena iz emaila za sesiju.
    let userId: string | undefined;
    if (query.code) {
      const { data, error } = await this.db.auth.exchangeCodeForSession(query.code);
      if (error) throw callbackError(error);
      userId = data.user?.id;
    } else if (query.token_hash && query.type) {
      const { data, error } = await this.db.auth.verifyOtp({
        token_hash: query.token_hash,
        // "signup" je stari naziv za potvrdu emaila; Supabase danas koristi "email".
        type: query.type === "signup" ? "email" : query.type,
      });
      if (error) throw callbackError(error);
      userId = data.user?.id;
    }
    if (!userId) throw new AppError("AUTH_CALLBACK_FAILED");

    // Korak 3: isto kao kod prijave lozinkom — nalog mora biti aktivan.
    return this.loadActiveProfile(userId, uiLocale);
  }

  /**
   * Šalje email sa linkom za reset lozinke (UC-04).
   * Ne otkriva da li nalog postoji: za nepoznat email se ništa ne šalje, a
   * odgovor je isti (204). Baca samo RATE_LIMITED (previše zahteva).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.db.auth.resetPasswordForEmail(email, {
      redirectTo: this.callbackUrl("/reset-password"),
    });
    if (!error) return;
    const appError = mapAuthError(error);
    if (appError.code === "RATE_LIMITED") throw appError;
    // Ostale greške se samo beleže, da odgovor ne bi otkrio da li nalog postoji.
    console.warn("[auth] reset lozinke nije poslat:", error.code ?? error.message);
  }

  /**
   * Postavlja novu lozinku prijavljenom korisniku (UC-04 posle linka iz emaila,
   * ili promena lozinke na stranici /profile).
   * Ulaz: nova lozinka i token iz zaglavlja Authorization (ili null za kolačić).
   * Baca: VALIDATION_ERROR (slaba ili ista lozinka), UNAUTHENTICATED.
   */
  async resetPassword(password: string, accessToken: string | null): Promise<void> {
    // Sesija iz kolačića: standardni poziv Supabase klijenta.
    if (!accessToken) {
      const { error } = await this.db.auth.updateUser({ password });
      if (error) throw mapAuthError(error);
      return;
    }
    // Token iz zaglavlja (Swagger/Postman): klijent nema sačuvanu sesiju, pa
    // se Supabase Auth API (PUT /auth/v1/user) poziva direktno sa tim tokenom.
    await updatePasswordWithToken(accessToken, password);
  }

  /** Pravi pun URL callback rute sa putanjom za povratak, npr. .../api/auth/callback?next=%2Fdashboard. */
  private callbackUrl(next: string): string {
    return `${this.siteUrl}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(next)}`;
  }

  /**
   * Posle uspešne prijave: čita profil i usklađuje jezik.
   *   - nema profila (nalog deaktiviran) -> odjava i ACCOUNT_DISABLED
   *   - korisnik je pre prijave izabrao jezik u interfejsu -> taj jezik se pamti u profilu
   * Vraća: profil (sa jezikom koji važi posle prijave).
   */
  private async loadActiveProfile(userId: string, uiLocale: Locale | null): Promise<Profile> {
    // Korak 1: profil (RLS ga ne vraća za deaktiviran nalog).
    const profile = await readProfile(this.db, userId);
    if (!profile) {
      await this.db.auth.signOut({ scope: "local" });
      throw new AppError("ACCOUNT_DISABLED");
    }

    // Korak 2: jezik izabran u interfejsu ima prednost i čuva se u profilu.
    if (uiLocale && uiLocale !== profile.locale) {
      const { error } = await this.db
        .from("profiles")
        .update({ locale: uiLocale })
        .eq("id", userId);
      if (!error) return { ...profile, locale: uiLocale };
      // Neuspeh upisa jezika ne sprečava prijavu.
      console.warn("[auth] jezik nije sačuvan u profilu:", error.message);
    }
    return profile;
  }
}

/**
 * Greška u callback-u: istekao ili već iskorišćen link, pogrešan kod...
 * Za korisnika je to uvek AUTH_CALLBACK_FAILED, osim previše pokušaja.
 */
function callbackError(error: AuthErrorLike): AppError {
  const mapped = mapAuthError(error);
  if (mapped.code === "RATE_LIMITED") return mapped;
  return new AppError(
    "AUTH_CALLBACK_FAILED",
    { reason: error.code ?? "unknown" },
    { cause: error },
  );
}

/**
 * Menja lozinku pozivom Supabase Auth API-ja sa pristupnim tokenom
 * (PUT /auth/v1/user). Koristi se kad API poziva Swagger ili Postman.
 * Baca: AppError preveden iz odgovora Supabase-a.
 */
async function updatePasswordWithToken(accessToken: string, password: string): Promise<void> {
  const { url, anonKey } = requireSupabaseEnv();
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  if (response.ok) return;
  // Supabase vraća { error_code, msg } ili { code, message }.
  const body = (await response.json().catch(() => ({}))) as {
    error_code?: string;
    code?: string | number;
    msg?: string;
    message?: string;
  };
  throw mapAuthError({
    code: body.error_code ?? (typeof body.code === "string" ? body.code : undefined),
    status: response.status,
    message: body.msg ?? body.message,
  });
}
