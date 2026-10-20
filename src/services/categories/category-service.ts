/**
 * Fajl: src/services/categories/category-service.ts
 * Svrha: CategoryService — čitanje kategorija zahteva (lista za formu
 * „Novi zahtev“ i za filtere). Dodavanje i izmena kategorija (admin, UC-22)
 * dolaze u Fazi 8.
 * Koriste ga: ruta GET /api/categories (a u Fazi 5b i stranice).
 * Povezano sa: tabela categories (RLS: korisnik i agent vide aktivne,
 * admin i neaktivne), docs/03 (klasa CategoryService).
 */
import { AppError, fromDbError } from "@/lib/errors/app-error";
import type { Category } from "@/lib/validation/categories";
import type { ServiceContext } from "@/services/service-context";
import { CATEGORY_COLUMNS, toCategory } from "@/services/shared/lookups";

/** Servis za kategorije. Čitanje: svi prijavljeni. */
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
