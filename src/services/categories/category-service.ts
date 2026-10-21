/**
 * Fajl: src/services/categories/category-service.ts
 * Svrha: CategoryService — kategorije zahteva:
 *   - čitanje (lista za formu „Novi zahtev“, filtere i analitiku)
 *   - dodavanje i izmena, uključujući deaktivaciju (admin, UC-22, Faza 8).
 *     Kategorija se ne briše: postojeći zahtevi je zadržavaju.
 * Koriste ga: rute /api/categories i /api/admin/categories, stranice.
 * Povezano sa: tabela categories (RLS: korisnik i agent vide aktivne,
 * admin i neaktivne), docs/03 (klasa CategoryService).
 */
import { AppError, fromDbError } from "@/lib/errors/app-error";
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/lib/validation/categories";
import type { ServiceContext } from "@/services/service-context";
import { CATEGORY_COLUMNS, toCategory } from "@/services/shared/lookups";
import type { Database } from "@/types/database";

/** Kolone za izmenu kategorije (generisani tip baze). */
type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];

/** Greška baze pri upisu; 23505 = narušen UNIQUE (oznaka već postoji). */
function fromCategoryWriteError(error: { code?: string; message: string }): AppError {
  if (error.code === "23505")
    return new AppError("CATEGORY_SLUG_TAKEN", undefined, { cause: error });
  return fromDbError(error);
}

/**
 * Pretvara polja iz API-ja (camelCase) u kolone tabele (snake_case).
 * Neposlata polja ostaju undefined i ne šalju se (JSON ih izostavlja), pa se ne menjaju.
 */
function toCategoryColumns(input: UpdateCategoryInput): CategoryUpdate {
  return {
    slug: input.slug,
    name_en: input.nameEn,
    name_sr: input.nameSr,
    description_en: input.descriptionEn,
    description_sr: input.descriptionSr,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  };
}

/** Servis za kategorije. Čitanje: svi prijavljeni; dodavanje i izmena: admin. */
export class CategoryService {
  /** Ulaz: ServiceContext. */
  constructor(private readonly ctx: ServiceContext) {}

  /** Aktivne kategorije, redom za prikaz (sort_order, pa naziv). */
  async listActive(): Promise<Category[]> {
    return this.query(true);
  }

  /**
   * Sve kategorije, i neaktivne (za administraciju).
   * Baca: FORBIDDEN ako pozivalac nije admin.
   */
  async listAll(): Promise<Category[]> {
    if (!this.ctx.auth.isAdmin()) throw new AppError("FORBIDDEN");
    return this.query(false);
  }

  /**
   * Nova kategorija (POST /api/admin/categories).
   * Baca: FORBIDDEN (nije admin), CATEGORY_SLUG_TAKEN (oznaka već postoji).
   */
  async create(input: CreateCategoryInput): Promise<Category> {
    // Korak 1: samo admin (proverava i RLS politika categories_insert_admin).
    if (!this.ctx.auth.isAdmin()) throw new AppError("FORBIDDEN");

    // Korak 2: upis i vraćanje novog reda.
    const { data, error } = await this.ctx.db
      .from("categories")
      .insert({
        slug: input.slug,
        name_en: input.nameEn,
        name_sr: input.nameSr,
        description_en: input.descriptionEn ?? null,
        description_sr: input.descriptionSr ?? null,
        sort_order: input.sortOrder,
      })
      .select(CATEGORY_COLUMNS)
      .single();
    if (error) throw fromCategoryWriteError(error);
    return toCategory(data);
  }

  /**
   * Izmena kategorije (PATCH /api/admin/categories/{id}); isActive = false je deaktivacija.
   * Baca: FORBIDDEN, NOT_FOUND (nema kategorije), CATEGORY_SLUG_TAKEN.
   */
  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    if (!this.ctx.auth.isAdmin()) throw new AppError("FORBIDDEN");

    // Korak 1: izmena samo poslatih polja (RLS: categories_update_admin).
    const { data, error } = await this.ctx.db
      .from("categories")
      .update(toCategoryColumns(input))
      .eq("id", id)
      .select(CATEGORY_COLUMNS);
    if (error) throw fromCategoryWriteError(error);

    // Korak 2: nijedan izmenjen red = kategorija ne postoji.
    const row = data[0];
    if (!row) throw new AppError("NOT_FOUND");
    return toCategory(row);
  }

  /** Zajednički upit; activeOnly = samo aktivne. */
  private async query(activeOnly: boolean): Promise<Category[]> {
    let request = this.ctx.db.from("categories").select(CATEGORY_COLUMNS);
    if (activeOnly) request = request.eq("is_active", true);
    const { data, error } = await request
      .order("sort_order", { ascending: true })
      .order("name_en", { ascending: true });
    if (error) throw fromDbError(error);
    return data.map(toCategory);
  }
}
