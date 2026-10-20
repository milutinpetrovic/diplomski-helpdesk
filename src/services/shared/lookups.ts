/**
 * Fajl: src/services/shared/lookups.ts
 * Svrha: pomoćne funkcije koje više servisa koristi da uz zahteve i komentare
 * učita povezane podatke jednim upitom:
 *   - imena korisnika (pogled profile_summaries, bez emaila)
 *   - kategorije (tabela categories)
 * Zašto posebni upiti, a ne spajanje (join) u jednom: pogled profile_summaries
 * sam odlučuje koja imena pozivalac sme da vidi (korisnik vidi sebe i tim
 * podrške), pa se ista pravila primenjuju svuda bez ponavljanja.
 * Koriste ga: TicketService, CommentService, UserAdminService.
 */
import { fromDbError } from "@/lib/errors/app-error";
import type { DbClient } from "@/lib/supabase/types";
import type { Category } from "@/lib/validation/categories";
import type { ProfileSummary } from "@/lib/validation/common";
import type { Database } from "@/types/database";

/** Red tabele categories, kako ga vraća Supabase. */
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

/** Kolone kategorije koje API vraća. */
export const CATEGORY_COLUMNS =
  "id, slug, name_en, name_sr, description_en, description_sr, is_active, sort_order";

/** Pretvara red kategorije (snake_case) u oblik za API (camelCase). */
export function toCategory(row: Omit<CategoryRow, "created_at">): Category {
  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameSr: row.name_sr,
    descriptionEn: row.description_en,
    descriptionSr: row.description_sr,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

/** Uklanja null i duplikate iz spiska ID-jeva. */
function uniqueIds(ids: readonly (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === "string"))];
}

/**
 * Učitava imena korisnika za dati spisak ID-jeva.
 * Ulaz: Supabase klijent (u ime prijavljenog) i ID-jevi (null se preskače).
 * Vraća: mapu ID -> ProfileSummary. ID koga pozivalac ne sme da vidi (npr.
 * deaktiviran agent za korisnika) nema u mapi, pa se prikazuje kao null.
 */
export async function loadProfileSummaries(
  db: DbClient,
  ids: readonly (string | null | undefined)[],
): Promise<Map<string, ProfileSummary>> {
  const wanted = uniqueIds(ids);
  const result = new Map<string, ProfileSummary>();
  if (wanted.length === 0) return result;

  const { data, error } = await db
    .from("profile_summaries")
    .select("id, full_name, avatar_url, role")
    .in("id", wanted);
  if (error) throw fromDbError(error);

  for (const row of data) {
    // Kolone pogleda su u tipovima označene kao moguće null; preskačemo nepotpune redove.
    if (!row.id || !row.full_name || !row.role) continue;
    result.set(row.id, {
      id: row.id,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      role: row.role,
    });
  }
  return result;
}

/**
 * Učitava kategorije za dati spisak ID-jeva.
 * Vraća: mapu ID -> Category. RLS korisniku ne vraća neaktivne kategorije;
 * takav zahtev u odgovoru ima category = null.
 */
export async function loadCategories(
  db: DbClient,
  ids: readonly (string | null | undefined)[],
): Promise<Map<string, Category>> {
  const wanted = uniqueIds(ids);
  const result = new Map<string, Category>();
  if (wanted.length === 0) return result;

  const { data, error } = await db.from("categories").select(CATEGORY_COLUMNS).in("id", wanted);
  if (error) throw fromDbError(error);

  for (const row of data) result.set(row.id, toCategory(row));
  return result;
}

/** Vrednost iz mape ili null (za ID koji je null ili nije vidljiv). */
export function pick<T>(map: Map<string, T>, id: string | null): T | null {
  return id ? (map.get(id) ?? null) : null;
}
