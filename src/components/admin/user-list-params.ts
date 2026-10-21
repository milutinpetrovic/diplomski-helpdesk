/**
 * Fajl: src/components/admin/user-list-params.ts
 * Svrha: filteri liste naloga u adresi stranice (/admin/users?q=jelena&role=agent&page=2),
 * po istom principu kao lista zahteva (src/components/tickets/list-params.ts):
 *   - parseUserListParams: adresa -> filteri (ista Zod šema kao API, userListQuerySchema)
 *   - userListHref: filteri -> adresa (podrazumevane vrednosti se izostavljaju)
 *   - hasActiveUserFilters: da li je uključen neki filter (dugme „Poništi filtere“)
 * Koriste ga: stranica /admin/users, UserFilters i UserPagination.
 * Povezano sa: src/lib/validation/admin.ts, GET /api/admin/users (isti parametri).
 */
import type { RawSearchParams } from "@/components/tickets/list-params";
import { userListQuerySchema, type UserListQuery } from "@/lib/validation/admin";

/** Parametri koje lista naloga razume (ostali se zanemaruju). */
const USER_PARAM_KEYS = ["q", "role", "isActive", "page", "pageSize"] as const;

/**
 * Čita filtere iz adrese.
 * Ulaz: searchParams stranice. Prazne vrednosti se tretiraju kao neposlate, a
 * neispravan parametar (npr. ručno upisan ?role=xyz) se zanemaruje.
 * Vraća: ispravne filtere sa podrazumevanim vrednostima (strana 1, 20 po strani).
 */
export function parseUserListParams(raw: RawSearchParams): UserListQuery {
  // Korak 1: samo poznati parametri, prva vrednost ako ih ima više, bez praznih.
  const values: Record<string, string> = {};
  for (const key of USER_PARAM_KEYS) {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined && first.trim() !== "") values[key] = first;
  }

  // Korak 2: provera Zod šemom; pogrešni parametri se izbacuju i provera ponavlja.
  const result = userListQuerySchema.safeParse(values);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete values[key];
  }
  return userListQuerySchema.safeParse(values).data ?? userListQuerySchema.parse({});
}

/** Podrazumevane vrednosti, koje se ne pišu u adresu. */
const DEFAULTS = userListQuerySchema.parse({});

/**
 * Pravi adresu liste naloga za date filtere.
 * Ulaz: trenutni filteri i izmene (npr. { page: 2 }).
 * Vraća: npr. "/admin/users?role=agent&page=2"; bez parametara samo "/admin/users".
 */
export function userListHref(
  query: Partial<UserListQuery>,
  changes: Partial<UserListQuery> = {},
): string {
  const merged: Partial<UserListQuery> = { ...query, ...changes };
  const params = new URLSearchParams();
  for (const key of USER_PARAM_KEYS) {
    const value = merged[key];
    if (value === undefined || value === "" || value === DEFAULTS[key]) continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `/admin/users?${text}` : "/admin/users";
}

/** Da li je uključena pretraga ili neki filter. */
export function hasActiveUserFilters(query: UserListQuery): boolean {
  return Boolean(query.q || query.role || query.isActive);
}
