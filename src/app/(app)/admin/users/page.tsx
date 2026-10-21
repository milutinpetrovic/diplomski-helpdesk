/**
 * Fajl: src/app/(app)/admin/users/page.tsx
 * Svrha: stranica /admin/users — upravljanje nalozima i ulogama (UC-21, FZ-3):
 * pretraga i filteri u adresi (?q=&role=&isActive=&page=), lista naloga sa
 * promenom uloge i aktivnosti, i stranice po 20 naloga.
 * Podaci se čitaju na serveru preko istog servisa kao GET /api/admin/users
 * (UserAdminService.list); izmene idu kroz PATCH /api/admin/users/{id}.
 * Pristup: admin (proverava admin/layout.tsx; servis i API proveravaju ponovo).
 * Povezano sa: UserFilters, UserTable, UserPagination, user-list-params.ts.
 */
import { getTranslations } from "next-intl/server";

import { UserFilters } from "@/components/admin/UserFilters";
import { UserPagination } from "@/components/admin/UserPagination";
import { UserTable } from "@/components/admin/UserTable";
import {
  hasActiveUserFilters,
  parseUserListParams,
  userListHref,
} from "@/components/admin/user-list-params";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireCurrentUser } from "@/lib/auth/server-session";
import { UserAdminService } from "@/services/admin/user-admin-service";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("users") };
}

/** Korisnici i uloge (serverska komponenta; izmene su u klijentskoj listi). */
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { ctx, profile } = await requireCurrentUser();
  const t = await getTranslations();

  // Korak 1: filteri iz adrese (neispravni parametri se zanemaruju).
  const query = parseUserListParams(await searchParams);

  // Korak 2: stranica naloga (servis proverava da je pozivalac admin).
  const page = await new UserAdminService(ctx).list(query);
  const filtersActive = hasActiveUserFilters(query);

  return (
    <>
      <PageHeader title={t("nav.users")} description={t("admin.users.description")} />

      {/* key: forma se ponovo pravi kad se filteri promene (npr. „Poništi filtere“). */}
      <UserFilters key={userListHref(query)} query={query} filtersActive={filtersActive} />

      <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
        {t("admin.users.total", { total: page.total })}
      </p>

      {page.items.length > 0 ? (
        <UserTable users={page.items} currentUserId={profile.id} />
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {t("admin.users.empty")}
        </p>
      )}

      <UserPagination query={query} total={page.total} />
    </>
  );
}
