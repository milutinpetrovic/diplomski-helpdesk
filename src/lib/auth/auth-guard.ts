/**
 * Fajl: src/lib/auth/auth-guard.ts
 * Svrha: AuthGuard — provera prijave i uloge na serveru (RBAC). Za svaki API
 * poziv utvrđuje ko je korisnik, da li je nalog aktivan i da li njegova uloga
 * sme da pozove rutu.
 * Koristi ga: withApi (src/lib/api/with-api.ts); kasnije i zaštićene stranice.
 * Povezano sa: Supabase klijenti (server.ts), AuthContext, tabela profiles
 * (uloga i is_active), docs/05 (dijagrami sekvenci, korak provere sesije).
 */
import { AuthContext } from "@/lib/auth/auth-context";
import { AppError } from "@/lib/errors/app-error";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import {
  createClientFromBearer,
  createServerSupabaseClient,
  readBearerToken,
} from "@/lib/supabase/server";
import type { DbClient } from "@/lib/supabase/types";
import type { UserRole } from "@/types/domain";

/** Supabase klijent za zahtev i token (ako je stigao kroz zaglavlje Authorization). */
export interface RequestClient {
  db: DbClient;
  accessToken: string | null;
}

/**
 * Pravi Supabase klijent za dolazni zahtev:
 *   - ako postoji `Authorization: Bearer <JWT>` (Swagger, Postman) -> klijent sa tim tokenom
 *   - inače -> klijent iz kolačića sesije (aplikacija)
 */
export async function createRequestClient(request: Request): Promise<RequestClient> {
  const accessToken = readBearerToken(request);
  const db = accessToken ? createClientFromBearer(accessToken) : await createServerSupabaseClient();
  return { db, accessToken };
}

/**
 * Utvrđuje ko je prijavljen. Vraća null ako niko nije prijavljen (ili je
 * token neispravan / istekao).
 * Baca ACCOUNT_DISABLED ako je nalog deaktiviran (RLS tada ne vraća ni
 * sopstveni profil).
 */
export async function getAuthContext({
  db,
  accessToken,
}: RequestClient): Promise<AuthContext | null> {
  // Korak 1: provera tokena kod Supabase Auth servisa (ne verujemo samo kolačiću).
  const { data, error } = accessToken
    ? await db.auth.getUser(accessToken)
    : await db.auth.getUser();
  if (error || !data.user) return null;

  // Korak 2: uloga i jezik iz profila. Deaktiviran nalog ne vidi sopstveni red.
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role, locale")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw new AppError("INTERNAL_ERROR", undefined, { cause: profileError });
  if (!profile) throw new AppError("ACCOUNT_DISABLED");

  // Korak 3: AuthContext za servise.
  const locale = isLocale(profile.locale) ? profile.locale : defaultLocale;
  return new AuthContext(data.user.id, profile.role, locale);
}

/**
 * Zahteva prijavljenog korisnika sa jednom od navedenih uloga.
 * Baca: UNAUTHENTICATED (401) ako niko nije prijavljen, FORBIDDEN (403) ako
 * uloga nije dozvoljena, ACCOUNT_DISABLED (403) ako je nalog deaktiviran.
 */
export async function requireRole(
  client: RequestClient,
  roles: readonly UserRole[],
): Promise<AuthContext> {
  const auth = await getAuthContext(client);
  if (!auth) throw new AppError("UNAUTHENTICATED");
  if (!auth.hasRole(roles)) throw new AppError("FORBIDDEN");
  return auth;
}
