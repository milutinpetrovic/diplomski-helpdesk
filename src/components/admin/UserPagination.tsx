/**
 * Fajl: src/components/admin/UserPagination.tsx
 * Svrha: prethodna i sledeća strana liste naloga (20 po strani, NFZ-3).
 * Linkovi zadržavaju filtere iz adrese, menja se samo ?page.
 * Koristi ga: stranica /admin/users. Serverska komponenta (obični linkovi).
 * Povezano sa: user-list-params.ts (userListHref); isti izgled kao TicketPagination.
 */
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { userListHref } from "@/components/admin/user-list-params";
import { Button } from "@/components/ui/button";
import type { UserListQuery } from "@/lib/validation/admin";

/**
 * Paginacija naloga.
 * Ulaz: trenutni filteri (sa brojem strane) i ukupan broj naloga.
 * Ne prikazuje se ako sve staje na jednu stranu.
 */
export function UserPagination({ query, total }: { query: UserListQuery; total: number }) {
  const t = useTranslations("admin.users.pagination");
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  if (pages <= 1) return null;

  // Strana iza poslednje (ručno upisano ?page=99) i dalje nudi povratak.
  const previous = query.page > 1 ? Math.min(query.page - 1, pages) : null;
  const next = query.page < pages ? query.page + 1 : null;

  return (
    <nav aria-label={t("label")} className="mt-4 flex items-center justify-between gap-2">
      {previous ? (
        <Button asChild variant="outline" size="sm">
          <Link href={userListHref(query, { page: previous })} rel="prev">
            <ChevronLeft aria-hidden="true" />
            {t("previous")}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("status", { page: query.page, pages })}
      </p>
      {next ? (
        <Button asChild variant="outline" size="sm">
          <Link href={userListHref(query, { page: next })} rel="next">
            {t("next")}
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
