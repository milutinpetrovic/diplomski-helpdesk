/**
 * Fajl: src/services/profile/profile-service.ts
 * Svrha: ProfileService — čitanje i izmena SOPSTVENOG profila prijavljenog
 * korisnika (UC-06 pregled i izmena profila, UC-07 čuvanje jezika).
 * Koriste ga: API rute GET/PATCH /api/me (src/app/api/me/route.ts) i
 * serverske stranice (zaglavlje aplikacije, /profile) preko server-session.ts.
 * Povezano sa: tabela profiles (RLS: korisnik vidi i menja samo svoj red, i to
 * samo kolone full_name, avatar_url i locale), docs/03 (klasa ProfileService).
 * Pravilo: uloga, aktivnost i email se ovde NE menjaju (to radi admin, Faza 8).
 */
import { AppError, fromDbError } from "@/lib/errors/app-error";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import type { DbClient } from "@/lib/supabase/types";
import type { Profile, UpdateProfileInput } from "@/lib/validation/profile";
import type { ServiceContext } from "@/services/service-context";
import type { Database } from "@/types/database";

/** Red tabele profiles, kako ga vraća Supabase. */
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/** Kolone koje se čitaju za profil (bez updated_at, koji interfejsu ne treba). */
export const PROFILE_COLUMNS =
  "id, full_name, email, avatar_url, role, locale, is_active, created_at";

/**
 * Pretvara red iz baze (snake_case) u oblik koji vraća API (camelCase).
 * Nepoznat jezik (ne bi smelo da se desi zbog CHECK ograničenja) postaje srpski.
 */
export function toProfile(row: Omit<ProfileRow, "updated_at">): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    locale: isLocale(row.locale) ? row.locale : defaultLocale,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/**
 * Čita profil korisnika sa datim ID-jem.
 * Ulaz: Supabase klijent (u ime prijavljenog korisnika) i ID.
 * Vraća: profil, ili null ako ga RLS ne vraća (npr. deaktiviran nalog).
 * Koristi ga i AuthService posle prijave (provera da li je nalog aktivan).
 */
export async function readProfile(db: DbClient, userId: string): Promise<Profile | null> {
  const { data, error } = await db
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  return data ? toProfile(data) : null;
}

/** Servis za sopstveni profil. Uloge: svi prijavljeni (customer, agent, admin). */
export class ProfileService {
  /** Ulaz: ServiceContext (klijent u ime korisnika i ko je korisnik). */
  constructor(private readonly ctx: ServiceContext) {}

  /**
   * Vraća profil prijavljenog korisnika (GET /api/me).
   * Baca: ACCOUNT_DISABLED ako profil nije vidljiv (nalog deaktiviran u međuvremenu).
   */
  async getMe(): Promise<Profile> {
    const profile = await readProfile(this.ctx.db, this.ctx.auth.userId);
    if (!profile) throw new AppError("ACCOUNT_DISABLED");
    return profile;
  }

  /**
   * Menja ime i/ili jezik prijavljenog korisnika (PATCH /api/me).
   * Ulaz: proverena polja (updateProfileSchema). Vraća: ažuriran profil.
   */
  async updateMe(input: UpdateProfileInput): Promise<Profile> {
    // Korak 1: samo polja koja su poslata (camelCase -> kolone u bazi).
    const changes: { full_name?: string; locale?: string } = {};
    if (input.fullName !== undefined) changes.full_name = input.fullName;
    if (input.locale !== undefined) changes.locale = input.locale;

    // Korak 2: upis; RLS politika profiles_update_own dozvoljava samo sopstveni red.
    const { data, error } = await this.ctx.db
      .from("profiles")
      .update(changes)
      .eq("id", this.ctx.auth.userId)
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    if (error) throw fromDbError(error);
    if (!data) throw new AppError("ACCOUNT_DISABLED");

    // Korak 3: ažuriran profil u obliku za API.
    return toProfile(data);
  }
}
