/**
 * Fajl: src/components/admin/CategoryFormDialog.tsx
 * Svrha: dijalog sa formom za novu kategoriju ili izmenu postojeće (UC-22):
 * naziv i opis na srpskom i engleskom, oznaka (slug) i redosled.
 * Tok: Zod provera (createCategorySchema, ista kao u API-ju) ->
 *   - nova: POST /api/admin/categories
 *   - izmena: PATCH /api/admin/categories/{id} (šalju se sva polja forme)
 * -> poruka, zatvaranje dijaloga i osvežavanje liste (router.refresh).
 * Zauzeta oznaka (409 CATEGORY_SLUG_TAKEN) i ostale greške prikazuju se iznad dugmadi.
 * Koristi ga: CategoryTable (stranica /admin/categories). Uloga: admin.
 * Povezano sa: src/lib/validation/categories.ts, CategoryService.create/update.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { FormAlert } from "@/components/forms/FormAlert";
import { FormField, FormTextareaField } from "@/components/forms/FormField";
import { applyApiError } from "@/components/forms/apply-api-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApiClient } from "@/hooks/use-api-client";
import type { ErrorCode } from "@/lib/errors/codes";
import {
  createCategorySchema,
  type Category,
  type CreateCategoryInput,
} from "@/lib/validation/categories";

/** Vrednosti forme pre Zod obrade (redosled je tekst iz polja, šema ga pretvara u broj). */
type CategoryFormValues = z.input<typeof createCategorySchema>;

/** Polja forme, za prikaz grešaka iz API-ja ispod polja. */
const FIELDS = ["nameSr", "nameEn", "descriptionSr", "descriptionEn", "slug", "sortOrder"] as const;

/**
 * Dijalog „Nova kategorija“ / „Izmena kategorije“.
 * Ulaz: kategorija za izmenu (bez nje je nova) i dugme koje otvara dijalog.
 */
export function CategoryFormDialog({
  category,
  trigger,
}: {
  category?: Category;
  trigger: React.ReactNode;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t("common.closeDialog")}>
        <DialogHeader>
          <DialogTitle>
            {category
              ? t("admin.categories.form.titleEdit")
              : t("admin.categories.form.titleCreate")}
          </DialogTitle>
          <DialogDescription>{t("admin.categories.form.description")}</DialogDescription>
        </DialogHeader>
        {/* Forma se pravi iznova pri svakom otvaranju (sadržaj dijaloga se uklanja kad je zatvoren). */}
        <CategoryForm category={category} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sama forma kategorije.
 * Ulaz: kategorija za izmenu (ili ništa) i funkcija koja zatvara dijalog posle uspeha.
 */
function CategoryForm({ category, onDone }: { category?: Category; onDone: () => void }) {
  const t = useTranslations();
  const api = useApiClient();
  const router = useRouter();
  const [formError, setFormError] = useState<ErrorCode | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues, unknown, CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      nameSr: category?.nameSr ?? "",
      nameEn: category?.nameEn ?? "",
      descriptionSr: category?.descriptionSr ?? "",
      descriptionEn: category?.descriptionEn ?? "",
      slug: category?.slug ?? "",
      sortOrder: category?.sortOrder ?? 0,
    },
  });

  /** Slanje: POST (nova) ili PATCH (izmena), pa poruka i osvežavanje liste. */
  async function onSubmit(values: CreateCategoryInput) {
    setFormError(null);
    try {
      const saved = category
        ? await api.patch<Category>(`/admin/categories/${category.id}`, values)
        : await api.post<Category>("/admin/categories", values);
      toast.success(
        category
          ? t("admin.categories.updated", { name: saved.nameSr })
          : t("admin.categories.created", { name: saved.nameSr }),
      );
      onDone();
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, FIELDS));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {/* Nazivi: jedan ispod drugog na telefonu, jedan pored drugog na računaru. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="nameSr"
          label={t("admin.categories.form.nameSr")}
          maxLength={60}
          errorKey={errors.nameSr?.message}
          {...register("nameSr")}
        />
        <FormField
          id="nameEn"
          label={t("admin.categories.form.nameEn")}
          maxLength={60}
          errorKey={errors.nameEn?.message}
          {...register("nameEn")}
        />
      </div>
      <FormTextareaField
        id="descriptionSr"
        label={t("admin.categories.form.descriptionSr")}
        hint={t("admin.categories.form.descriptionHint")}
        rows={2}
        maxLength={300}
        errorKey={errors.descriptionSr?.message}
        {...register("descriptionSr")}
      />
      <FormTextareaField
        id="descriptionEn"
        label={t("admin.categories.form.descriptionEn")}
        hint={t("admin.categories.form.descriptionHint")}
        rows={2}
        maxLength={300}
        errorKey={errors.descriptionEn?.message}
        {...register("descriptionEn")}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <FormField
          id="slug"
          label={t("admin.categories.form.slug")}
          hint={t("admin.categories.form.slugHint")}
          maxLength={60}
          autoCapitalize="none"
          spellCheck={false}
          errorKey={errors.slug?.message}
          {...register("slug")}
        />
        <FormField
          id="sortOrder"
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          label={t("admin.categories.form.sortOrder")}
          hint={t("admin.categories.form.sortOrderHint")}
          errorKey={errors.sortOrder?.message}
          {...register("sortOrder")}
        />
      </div>
      {formError ? <FormAlert>{t(`errors.${formError}`)}</FormAlert> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t("admin.categories.form.cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {category
            ? t("admin.categories.form.submitEdit")
            : t("admin.categories.form.submitCreate")}
        </Button>
      </DialogFooter>
    </form>
  );
}
