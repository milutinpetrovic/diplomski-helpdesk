/**
 * Fajl: src/services/admin/user-admin-service.ts
 * Svrha: UserAdminService — rad sa nalozima korisnika za tim podrške.
 * U Fazi 5 ovde je samo spisak agenata (za padajuću listu „Dodeli agentu“,
 * UC-20); lista svih korisnika i izmena uloga (admin, UC-21) dolaze u Fazi 8.
 * Koriste ga: ruta GET /api/agents.
 * Povezano sa: tabela profiles (RLS: tim podrške vidi sve profile),
 * docs/03 (klasa UserAdminService).
 */
import { fromDbError } from "@/lib/errors/app-error";
import type { AgentSummary } from "@/lib/validation/admin";
import type { ServiceContext } from "@/services/service-context";
import { STAFF_ROLES } from "@/types/domain";

/** Statusi u kojima je zahtev još „u radu“ kod agenta (nije rešen ni zatvoren). */
const OPEN_STATUSES = ["open", "in_progress", "waiting_on_customer"] as const;

/** Servis za naloge. Uloge: agent i admin (spisak agenata). */
export class UserAdminService {
  /** Ulaz: ServiceContext. */
  constructor(private readonly ctx: ServiceContext) {}

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
