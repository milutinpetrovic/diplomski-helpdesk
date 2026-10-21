/**
 * Fajl: src/services/admin/user-admin-service.ts
 * Svrha: UserAdminService — rad sa nalozima:
 *   - spisak agenata za padajuću listu „Dodeli agentu“ (UC-20, agent i admin)
 *   - lista svih naloga sa pretragom i filterima (UC-21, admin, Faza 8)
 *   - izmena uloge i aktivnosti naloga (UC-21, admin, Faza 8) preko RPC
 *     funkcije admin_update_user, koja u istoj transakciji vraća u red
 *     nerešene zahteve agenta koji izgubi ulogu ili bude deaktiviran
 * Koriste ga: rute GET /api/agents, GET /api/admin/users,
 * PATCH /api/admin/users/{id} i stranica /admin/users.
 * Povezano sa: tabela profiles (RLS: tim podrške vidi sve profile),
 * docs/03 (klasa UserAdminService).
 */
import { AppError, fromDbError } from "@/lib/errors/app-error";
import type {
  AdminUpdateUserInput,
  AdminUser,
  AgentSummary,
  UserListQuery,
} from "@/lib/validation/admin";
import type { Paginated } from "@/lib/validation/common";
import { PROFILE_COLUMNS, toProfile } from "@/services/profile/profile-service";
import type { ServiceContext } from "@/services/service-context";
import { STAFF_ROLES } from "@/types/domain";

/** Statusi u kojima je zahtev još „u radu“ kod agenta (nije rešen ni zatvoren). */
const OPEN_STATUSES = ["open", "in_progress", "waiting_on_customer"] as const;

/**
 * Pretraga za PostgREST filter or(...): uklanja znakove koji imaju posebno
 * značenje u filteru (zarez, zagrade, *, %, navodnici i obrnuta kosa crta), da unos ne bi promenio upit.
 */
export function sanitizeUserSearch(q: string): string {
  return q.replace(/[,()*%"\\]/g, " ").trim();
}

/** Servis za naloge. Uloge: agent i admin (spisak agenata), admin (sve ostalo). */
export class UserAdminService {
  /** Ulaz: ServiceContext. */
  constructor(private readonly ctx: ServiceContext) {}

  /**
   * Lista naloga za administraciju (GET /api/admin/users), po imenu.
   * Ulaz: q (deo imena ili emaila), role, isActive, page, pageSize.
   * Vraća: stranicu naloga sa brojem dodeljenih nerešenih zahteva.
   * Baca: FORBIDDEN ako pozivalac nije admin.
   */
  async list(query: UserListQuery): Promise<Paginated<AdminUser>> {
    if (!this.ctx.auth.isAdmin()) throw new AppError("FORBIDDEN");

    // Korak 1: upit sa filterima i paginacijom.
    const from = (query.page - 1) * query.pageSize;
    let request = this.ctx.db.from("profiles").select(PROFILE_COLUMNS, { count: "exact" });
    const search = query.q ? sanitizeUserSearch(query.q) : "";
    if (search) request = request.or(`full_name.ilike.*${search}*,email.ilike.*${search}*`);
    if (query.role) request = request.eq("role", query.role);
    if (query.isActive) request = request.eq("is_active", query.isActive === "true");
    const { data, error, count } = await request
      .order("full_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + query.pageSize - 1);
    if (error) throw fromDbError(error);

    // Korak 2: broj nerešenih dodeljenih zahteva (samo za članove tima na stranici).
    const counts = await this.countOpenAssigned(
      data.filter((row) => row.role !== "customer").map((row) => row.id),
    );

    return {
      items: data.map((row) => ({ ...toProfile(row), openAssignedCount: counts.get(row.id) ?? 0 })),
      page: query.page,
      pageSize: query.pageSize,
      total: count ?? 0,
    };
  }

  /**
   * Izmena uloge i/ili aktivnosti naloga (PATCH /api/admin/users/{id}).
   * Ako agent ili admin izgubi ulogu tima ili bude deaktiviran, baza u istoj
   * transakciji vraća njegove nerešene zahteve u red (status open, nedodeljen).
   * Baca: FORBIDDEN (nije admin), CANNOT_MODIFY_SELF (sopstveni nalog),
   * NOT_FOUND (nalog ne postoji).
   */
  async update(id: string, input: AdminUpdateUserInput): Promise<AdminUser> {
    // Korak 1: pravila pre poziva baze (jasna greška); baza ih proverava ponovo.
    if (!this.ctx.auth.isAdmin()) throw new AppError("FORBIDDEN");
    if (id === this.ctx.auth.userId) throw new AppError("CANNOT_MODIFY_SELF");

    // Korak 2: RPC admin_update_user (izmena + oslobađanje zahteva, jedna transakcija).
    const { data, error } = await this.ctx.db.rpc("admin_update_user", {
      p_user_id: id,
      p_role: input.role,
      p_is_active: input.isActive,
    });
    if (error) throw fromDbError(error);

    // Korak 3: novi profil i trenutni broj dodeljenih zahteva.
    const counts = await this.countOpenAssigned([data.id]);
    return { ...toProfile(data), openAssignedCount: counts.get(data.id) ?? 0 };
  }

  /** Broj nerešenih zahteva dodeljenih svakom od datih naloga. */
  private async countOpenAssigned(ids: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (ids.length === 0) return counts;
    const { data, error } = await this.ctx.db
      .from("tickets")
      .select("assigned_to")
      .in("assigned_to", ids)
      .in("status", [...OPEN_STATUSES]);
    if (error) throw fromDbError(error);
    for (const { assigned_to } of data) {
      if (assigned_to) counts.set(assigned_to, (counts.get(assigned_to) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Aktivni agenti i admini sa brojem nerešenih zahteva koji su im dodeljeni
   * (da admin vidi ko je najmanje opterećen pri dodeli).
   * Vraća: spisak po imenu.
   */
  async listAgents(): Promise<AgentSummary[]> {
    // Korak 1: aktivni članovi tima.
    const { data: staff, error } = await this.ctx.db
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .in("role", [...STAFF_ROLES])
      .eq("is_active", true)
      .order("full_name", { ascending: true });
    if (error) throw fromDbError(error);
    if (staff.length === 0) return [];

    // Korak 2: dodeljeni nerešeni zahtevi (samo kolona assigned_to) i brojanje po agentu.
    const { data: assigned, error: ticketsError } = await this.ctx.db
      .from("tickets")
      .select("assigned_to")
      .in(
        "assigned_to",
        staff.map((member) => member.id),
      )
      .in("status", [...OPEN_STATUSES]);
    if (ticketsError) throw fromDbError(ticketsError);

    const counts = new Map<string, number>();
    for (const { assigned_to } of assigned) {
      if (assigned_to) counts.set(assigned_to, (counts.get(assigned_to) ?? 0) + 1);
    }

    // Korak 3: oblik za API.
    return staff.map((member) => ({
      id: member.id,
      fullName: member.full_name,
      avatarUrl: member.avatar_url,
      role: member.role,
      openAssignedCount: counts.get(member.id) ?? 0,
    }));
  }
}
