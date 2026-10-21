/**
 * Fajl: src/services/dashboard/dashboard-service.ts
 * Svrha: DashboardService — podaci za kontrolni panel (UC-25), različiti po ulozi:
 *   - korisnik: njegovi zahtevi po statusu, „čeka vaš odgovor“, „ocenite
 *     rešenje“ i poslednjih 5 zahteva
 *   - agent: njegovi zahtevi po statusu, red nedodeljenih, hitni (ceo tim), njegova
 *     prosečna ocena i broj rešenih
 *   - admin: ukupno otvorenih, nedodeljenih i hitnih, opterećenje po agentu,
 *     najstariji nedodeljeni
 * Sve se čita sa pravima prijavljenog korisnika (RLS), pa korisnik nikad ne
 * broji niti vidi tuđe zahteve. Brojeve računa baza (ticket_counts,
 * agent_dashboard_stats), a liste su mali upiti sa najviše 5 redova.
 * Koriste ga: ruta GET /api/dashboard i stranica /dashboard.
 * Povezano sa: docs/03 (klasa DashboardService), src/lib/validation/dashboard.ts,
 * supabase/migrations/..._dashboard.sql.
 */
import { fromDbError } from "@/lib/errors/app-error";
import type {
  AdminDashboard,
  AgentDashboard,
  CustomerDashboard,
  DashboardData,
  DashboardTicket,
} from "@/lib/validation/dashboard";
import { UserAdminService } from "@/services/admin/user-admin-service";
import { summarizeCounts, UNRESOLVED_STATUSES } from "@/services/dashboard/dashboard-counts";
import type { ServiceContext } from "@/services/service-context";
import type { Database } from "@/types/database";
import type { TicketPriority, TicketStatus } from "@/types/domain";

/** Koliko zahteva najviše ide u svaku listu na panelu. */
export const DASHBOARD_LIST_SIZE = 5;

/** Kolone zahteva potrebne za listu na panelu. */
const DASHBOARD_TICKET_COLUMNS = "id, number, title, status, priority, created_at, updated_at";

/** Red zahteva sa tim kolonama. */
type DashboardTicketRow = Pick<
  Database["public"]["Tables"]["tickets"]["Row"],
  "id" | "number" | "title" | "status" | "priority" | "created_at" | "updated_at"
>;

/** Pretvara red (snake_case) u oblik za API (camelCase). */
function toDashboardTicket(row: DashboardTicketRow): DashboardTicket {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Filteri za kratke liste zahteva na panelu (sva polja su opciona). */
interface TicketListFilter {
  /** Samo zahtevi u ovim statusima. */
  statuses?: readonly TicketStatus[];
  /** Samo zahtevi ovog prioriteta. */
  priority?: TicketPriority;
  /** Samo nedodeljeni zahtevi. */
  unassigned?: boolean;
  /** true = poslednje menjani prvo; inače najstariji (po kreiranju) prvo. */
  newestUpdatedFirst?: boolean;
}

/** Servis za kontrolni panel. Uloge: svi prijavljeni (svako dobija svoj oblik). */
export class DashboardService {
  /** Ulaz: ServiceContext. */
  constructor(private readonly ctx: ServiceContext) {}

  /**
   * Podaci panela za prijavljenog korisnika, po njegovoj ulozi.
   * Vraća: DashboardData sa poljem kind = customer | agent | admin.
   */
  async getForCurrentUser(): Promise<DashboardData> {
    switch (this.ctx.auth.role) {
      case "customer":
        return this.forCustomer();
      case "agent":
        return this.forAgent();
      case "admin":
        return this.forAdmin();
    }
  }

  /** Panel korisnika. */
  private async forCustomer(): Promise<CustomerDashboard> {
    // Korak 1: brojevi, zahtevi koji čekaju odgovor i poslednji zahtevi, paralelno.
    const [counts, waitingOnMe, recent, toRate] = await Promise.all([
      this.loadCounts(),
      this.loadTickets({ statuses: ["waiting_on_customer"], newestUpdatedFirst: true }),
      this.loadTickets({ newestUpdatedFirst: true }),
      this.loadUnratedTickets(),
    ]);

    // Korak 2: oblik za API (RLS je već ograničio sve na korisnikove zahteve).
    return { kind: "customer", statusCounts: counts.statusCounts, waitingOnMe, toRate, recent };
  }

  /** Panel agenta. */
  private async forAgent(): Promise<AgentDashboard> {
    // Korak 1: brojevi, lične statistike i dve liste, paralelno.
    const [counts, stats, unassignedQueue, urgent] = await Promise.all([
      this.loadCounts(),
      this.loadAgentStats(),
      this.loadUnassignedQueue(),
      // Hitni nerešeni zahtevi celog tima (agent vidi sve zahteve), najstariji prvi.
      this.loadTickets({ statuses: UNRESOLVED_STATUSES, priority: "urgent" }),
    ]);

    // Korak 2: oblik za API.
    return {
      kind: "agent",
      myStatusCounts: counts.myStatusCounts,
      unassignedCount: counts.unassignedCount,
      urgentCount: counts.urgentCount,
      unassignedQueue,
      urgent,
      rating: { average: stats.average, count: stats.count },
      resolvedCount: stats.resolvedCount,
    };
  }

  /** Panel administratora. */
  private async forAdmin(): Promise<AdminDashboard> {
    // Korak 1: brojevi, opterećenje tima (isti spisak kao za dodelu) i red čekanja.
    const [counts, workload, unassignedQueue] = await Promise.all([
      this.loadCounts(),
      new UserAdminService(this.ctx).listAgents(),
      this.loadUnassignedQueue(),
    ]);

    // Korak 2: oblik za API; najopterećeniji član tima prvi.
    return {
      kind: "admin",
      statusCounts: counts.statusCounts,
      openCount: counts.openCount,
      unassignedCount: counts.unassignedCount,
      urgentCount: counts.urgentCount,
      workload: [...workload].sort((a, b) => b.openAssignedCount - a.openAssignedCount),
      unassignedQueue,
    };
  }

  /** Brojevi zahteva iz SQL funkcije ticket_counts(). */
  private async loadCounts() {
    const { data, error } = await this.ctx.db.rpc("ticket_counts");
    if (error) throw fromDbError(error);
    return summarizeCounts(data);
  }

  /**
   * Prosečna ocena i broj rešenih zahteva prijavljenog agenta
   * (SQL funkcija agent_dashboard_stats()).
   */
  private async loadAgentStats() {
    const { data, error } = await this.ctx.db.rpc("agent_dashboard_stats").single();
    if (error) throw fromDbError(error);
    return {
      // Prosek je null dok agent nema nijednu ocenu (tipovi baze to ne znaju).
      average: data.avg_rating === null ? null : Number(data.avg_rating),
      count: data.rating_count,
      resolvedCount: data.resolved_count,
    };
  }

  /** Najstariji nedodeljeni nerešeni zahtevi (red čekanja tima). */
  private loadUnassignedQueue(): Promise<DashboardTicket[]> {
    return this.loadTickets({ statuses: UNRESOLVED_STATUSES, unassigned: true });
  }

  /**
   * Rešeni ili zatvoreni zahtevi korisnika koje još nije ocenio (najnoviji prvo).
   * Ocene se čitaju posebnim upitom i oduzimaju od spiska, kao i ostali
   * povezani podaci u servisima (bez spajanja tabela).
   */
  private async loadUnratedTickets(): Promise<DashboardTicket[]> {
    // Korak 1: korisnikovi rešeni i zatvoreni zahtevi (RLS: samo njegovi).
    const { data: finished, error } = await this.ctx.db
      .from("tickets")
      .select(DASHBOARD_TICKET_COLUMNS)
      .in("status", ["resolved", "closed"])
      .order("updated_at", { ascending: false });
    if (error) throw fromDbError(error);
    if (finished.length === 0) return [];

    // Korak 2: koji od njih već imaju ocenu.
    const { data: ratings, error: ratingsError } = await this.ctx.db
      .from("ticket_ratings")
      .select("ticket_id")
      .in(
        "ticket_id",
        finished.map((ticket) => ticket.id),
      );
    if (ratingsError) throw fromDbError(ratingsError);
    const rated = new Set(ratings.map((rating) => rating.ticket_id));

    // Korak 3: neocenjeni, najviše 5.
    return finished
      .filter((ticket) => !rated.has(ticket.id))
      .slice(0, DASHBOARD_LIST_SIZE)
      .map(toDashboardTicket);
  }

  /**
   * Zajednički upit za liste na panelu: najviše 5 zahteva.
   * Ulaz: filteri (TicketListFilter). Vraća: zahteve u kratkom obliku.
   */
  private async loadTickets(filter: TicketListFilter): Promise<DashboardTicket[]> {
    // Korak 1: osnovni upit (RLS ograničava na zahteve koje korisnik sme da vidi).
    let query = this.ctx.db.from("tickets").select(DASHBOARD_TICKET_COLUMNS);

    // Korak 2: filteri.
    if (filter.statuses) query = query.in("status", [...filter.statuses]);
    if (filter.priority) query = query.eq("priority", filter.priority);
    if (filter.unassigned) query = query.is("assigned_to", null);

    // Korak 3: redosled (najstariji prvo, ili poslednje menjani prvo) i ograničenje.
    const { data, error } = await query
      .order(filter.newestUpdatedFirst ? "updated_at" : "created_at", {
        ascending: !filter.newestUpdatedFirst,
      })
      .limit(DASHBOARD_LIST_SIZE);
    if (error) throw fromDbError(error);
    return data.map(toDashboardTicket);
  }
}
