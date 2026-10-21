/**
 * Fajl: src/components/admin/UserFilters.tsx
 * Svrha: pretraga i filteri iznad liste naloga (UC-21): ime ili email, uloga
 * i aktivnost. Izbor u padajućoj listi odmah primenjuje filter; pretraga se
 * primenjuje na Enter ili dugme „Traži“. Filteri se upisuju u adresu
 * (/admin/users?role=agent), pa server učitava novu listu.
 * Koristi ga: stranica /admin/users. Klijentska komponenta. Uloga: admin.
 * Povezano sa: user-list-params.ts (adresa <-> filteri), GET /api/admin/users.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { userListHref } from "@/components/admin/user-list-params";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { UserListQuery } from "@/lib/validation/admin";
import { USER_ROLES } from "@/types/domain";

/** Polja forme (imena su ista kao parametri u adresi). */
const FILTER_FIELDS = ["q", "role", "isActive"] as const;

/**
 * Forma filtera naloga.
 * Ulaz: trenutni filteri (iz adrese) i da li je neki uključen.
 */
export function UserFilters({
  query,
  filtersActive,
}: {
  query: UserListQuery;
  filtersActive: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();

  /** Primena filtera: vrednosti forme -> nova adresa, uvek od prve strane. */
  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const changes: Record<string, string | undefined> = {};
    for (const field of FILTER_FIELDS) {
      const value = data.get(field);
      changes[field] = typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
    }
    router.push(userListHref({ ...query, ...changes, page: 1 }));
  }

  return (
    <form
      role="search"
      aria-label={t("admin.users.filters.label")}
      onSubmit={(event) => {
        event.preventDefault();
        apply(event.currentTarget);
      }}
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) apply(event.currentTarget);
      }}
      className="mb-4 flex flex-col gap-3"
    >
      {/* Pretraga po imenu ili emailu, pa uloga i status (na računaru, od širine lg, u jednom redu). */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_12rem_12rem]">
        <div className="col-span-2 flex flex-col gap-2 lg:col-span-1">
          <Label htmlFor="q">{t("admin.users.filters.search")}</Label>
          <div className="flex gap-2">
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q ?? ""}
              placeholder={t("admin.users.filters.searchPlaceholder")}
              maxLength={100}
            />
            <Button type="submit" variant="outline">
              <Search aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">
                {t("admin.users.filters.searchSubmit")}
              </span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="role">{t("admin.users.columns.role")}</Label>
          <NativeSelect id="role" name="role" defaultValue={query.role ?? ""}>
            <option value="">{t("admin.users.filters.allRoles")}</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="isActive">{t("admin.users.columns.status")}</Label>
          <NativeSelect id="isActive" name="isActive" defaultValue={query.isActive ?? ""}>
            <option value="">{t("admin.users.filters.all")}</option>
            <option value="true">{t("admin.users.filters.active")}</option>
            <option value="false">{t("admin.users.filters.inactive")}</option>
          </NativeSelect>
        </div>
      </div>

      {filtersActive ? (
        <Button asChild variant="link" size="sm" className="self-start px-0">
          <Link href={userListHref({})}>{t("admin.users.filters.reset")}</Link>
        </Button>
      ) : null}
    </form>
  );
}
