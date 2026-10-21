/**
 * Fajl: src/app/(app)/admin/categories/page.tsx
 * Svrha: stranica /admin/categories — upravljanje kategorijama (UC-22): sve
 * kategorije (i neaktivne), dugme „Nova kategorija“, izmena i (de)aktivacija.
 * Podaci se čitaju na serveru preko CategoryService.listAll; izmene idu kroz
 * POST /api/admin/categories i PATCH /api/admin/categories/{id}.
 * Pristup: admin (proverava admin/layout.tsx; servis i API proveravaju ponovo).
 * Povezano sa: CategoryTable, CategoryFormDialog.
 */
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CategoryFormDialog } from "@/components/admin/CategoryFormDialog";
import { CategoryTable } from "@/components/admin/CategoryTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { requireCurrentUser } from "@/lib/auth/server-session";
import { CategoryService } from "@/services/categories/category-service";

/** Naslov taba. */
export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("categories") };
}

/** Kategorije (serverska komponenta; forma i dugmad su klijentski). */
export default async function AdminCategoriesPage() {
  const { ctx } = await requireCurrentUser();
  const t = await getTranslations();

  // Sve kategorije, i neaktivne (servis proverava da je pozivalac admin).
  const categories = await new CategoryService(ctx).listAll();

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={t("nav.categories")} description={t("admin.categories.description")} />
        <CategoryFormDialog
          trigger={
            <Button className="mb-6 self-start">
              <Plus aria-hidden="true" />
              {t("admin.categories.new")}
            </Button>
          }
        />
      </div>
      <CategoryTable categories={categories} />
    </>
  );
}
