/**
 * Fajl: src/components/admin/CategoryTable.tsx
 * Svrha: lista svih kategorija (i neaktivnih) na stranici /admin/categories (UC-22).
 * U svakom redu: redosled, naziv na izabranom jeziku (i na drugom jeziku
 * ispod), oznaka, status i dugmad „Izmeni“ (dijalog sa formom) i
 * „Deaktiviraj“ / „Aktiviraj“. Kategorija se ne briše: deaktivirana ostaje na
 * postojećim zahtevima, a ne nudi se pri kreiranju novih.
 * Koristi ga: stranica /admin/categories. Klijentska komponenta. Uloga: admin.
 * Povezano sa: CategoryFormDialog, PATCH /api/admin/categories/{id}, useApiAction.
 */
"use client";

import { useLocale, useTranslations } from "next-intl";
import { Pencil } from "lucide-react";

import { CategoryFormDialog } from "@/components/admin/CategoryFormDialog";
import { Button } from "@/components/ui/button";
import { useApiAction } from "@/hooks/use-api-action";
import type { Category } from "@/lib/validation/categories";

/** Lista kategorija. Ulaz: sve kategorije, redom za prikaz (CategoryService.listAll). */
export function CategoryTable({ categories }: { categories: Category[] }) {
  const t = useTranslations("admin.categories");
  const locale = useLocale();
  const { run, pending } = useApiAction();

  /** (De)aktivacija: PATCH /api/admin/categories/{id} { isActive }. */
  function toggle(category: Category) {
    const isActive = !category.isActive;
    const name = locale === "sr" ? category.nameSr : category.nameEn;
    void run(
      (api) => api.patch(`/admin/categories/${category.id}`, { isActive }),
      isActive ? t("activated", { name }) : t("deactivated", { name }),
    );
  }

  if (categories.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border" aria-label={t("caption")}>
      {categories.map((category) => {
        // Naziv na izabranom jeziku je glavni, drugi jezik je ispod (admin proverava oba).
        const [main, other] =
          locale === "sr" ? [category.nameSr, category.nameEn] : [category.nameEn, category.nameSr];
        const description = locale === "sr" ? category.descriptionSr : category.descriptionEn;

        return (
          <li
            key={category.id}
            className="flex flex-col gap-3 p-4 sm:grid sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
          >
            {/* Redosled u listama. */}
            <p className="text-sm text-muted-foreground">
              <span className="sm:sr-only">{t("columns.order")}: </span>
              <span className="font-mono">{category.sortOrder}</span>
            </p>

            {/* Nazivi, oznaka, opis i status. */}
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <span>{main}</span>
                <span className="font-normal text-muted-foreground">/ {other}</span>
                {!category.isActive ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    {t("statusInactive")}
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("columns.slug")}: <code className="font-mono">{category.slug}</code>
              </p>
              {description ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>

            {/* Akcije. */}
            <div className="flex gap-2 sm:justify-end">
              <CategoryFormDialog
                category={category}
                trigger={
                  <Button variant="outline" size="sm" aria-label={t("editFor", { name: main })}>
                    <Pencil aria-hidden="true" />
                    {t("edit")}
                  </Button>
                }
              />
              <Button
                variant={category.isActive ? "outline" : "secondary"}
                size="sm"
                disabled={pending}
                onClick={() => toggle(category)}
                aria-label={
                  category.isActive
                    ? t("deactivateFor", { name: main })
                    : t("activateFor", { name: main })
                }
              >
                {category.isActive ? t("deactivate") : t("activate")}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
