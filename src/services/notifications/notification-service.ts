/**
 * Fajl: src/services/notifications/notification-service.ts
 * Svrha: NotificationService — obaveštenja prijavljenog korisnika (UC-08):
 * lista sa brojem nepročitanih, označavanje jednog ili svih kao pročitanih.
 * Ovaj servis obaveštenja NE pravi: upisuju ih RPC funkcije u bazi, u istoj
 * transakciji sa izmenom zahteva (novi zahtev, dodela, status, komentar, ocena).
 * Sve se čita i menja sa pravima prijavljenog korisnika (RLS: samo sopstvena
 * obaveštenja, i menja se samo kolona is_read).
 * Koriste ga: rute u src/app/api/notifications/ i stranica /notifications.
 * Povezano sa: docs/03 (klasa NotificationService), src/lib/validation/notifications.ts,
 * tabela notifications (migracija ..._ratings_notifications.sql).
 */
import { AppError, fromDbError } from "@/lib/errors/app-error";
import type {
  NotificationItem,
  NotificationList,
  NotificationListQuery,
} from "@/lib/validation/notifications";
import type { ServiceContext } from "@/services/service-context";
import { loadProfileSummaries } from "@/services/shared/lookups";
import type { Database } from "@/types/database";

/** Red tabele notifications. */
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

/** Broj i naslov zahteva uz obaveštenje. */
interface TicketRef {
  number: number;
  title: string;
}

/** Servis za obaveštenja. Uloge: svi prijavljeni (svako samo svoja). */
export class NotificationService {
  /** Ulaz: ServiceContext. */
  constructor(private readonly ctx: ServiceContext) {}

  /**
   * Stranica obaveštenja, najnovija prva (GET /api/notifications).
   * Ulaz: page, pageSize i unreadOnly ("true" = samo nepročitana).
   * Vraća: { items, page, pageSize, total, unreadCount }.
   */
  async list(query: NotificationListQuery): Promise<NotificationList> {
    // Korak 1: upit sa filterom i paginacijom (RLS: samo sopstvena obaveštenja).
    const from = (query.page - 1) * query.pageSize;
    let request = this.ctx.db
      .from("notifications")
      .select("id, type, ticket_id, actor_id, is_read, created_at", { count: "exact" });
    if (query.unreadOnly === "true") request = request.eq("is_read", false);

    // Korak 2: obaveštenja i broj nepročitanih, paralelno.
    const [page, unreadCount] = await Promise.all([
      request
        .order("created_at", { ascending: false })
        // Isto vreme (npr. status i komentar u istom trenutku): stalan redosled po ID-ju.
        .order("id", { ascending: false })
        .range(from, from + query.pageSize - 1),
      this.countUnread(),
    ]);
    if (page.error) throw fromDbError(page.error);

    // Korak 3: broj i naslov zahteva i ime aktera, posebnim upitima.
    const items = await this.withDetails(page.data);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: page.count ?? 0,
      unreadCount,
    };
  }

  /** Broj nepročitanih obaveštenja prijavljenog korisnika. */
  async countUnread(): Promise<number> {
    const { count, error } = await this.ctx.db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);
    if (error) throw fromDbError(error);
    return count ?? 0;
  }

  /**
   * Označava jedno obaveštenje kao pročitano (POST /api/notifications/{id}/read).
   * Ponovno označavanje već pročitanog nije greška.
   * Baca: NOT_FOUND ako obaveštenje ne postoji ili nije korisnikovo (RLS ga ne vidi).
   */
  async markRead(id: string): Promise<void> {
    // Korak 1: izmena samo kolone is_read; RLS propušta samo sopstveni red.
    const { data, error } = await this.ctx.db
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .select("id");
    if (error) throw fromDbError(error);

    // Korak 2: nijedan izmenjen red = tuđe ili nepostojeće obaveštenje.
    if (data.length === 0) throw new AppError("NOT_FOUND");
  }

  /** Označava sva nepročitana obaveštenja korisnika kao pročitana (POST .../read-all). */
  async markAllRead(): Promise<void> {
    const { error } = await this.ctx.db
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);
    if (error) throw fromDbError(error);
  }

  /**
   * Dodaje broj i naslov zahteva i ime aktera uz svako obaveštenje.
   * Zahtevi se čitaju pod RLS-om, pa uz obaveštenje stoji samo ono što
   * korisnik i inače sme da vidi.
   */
  private async withDetails(
    rows: Pick<
      NotificationRow,
      "id" | "type" | "ticket_id" | "actor_id" | "is_read" | "created_at"
    >[],
  ): Promise<NotificationItem[]> {
    // Korak 1: zahtevi na koje se obaveštenja odnose.
    const ticketIds = [...new Set(rows.map((row) => row.ticket_id).filter((id) => id !== null))];
    const tickets = new Map<string, TicketRef>();
    if (ticketIds.length > 0) {
      const { data, error } = await this.ctx.db
        .from("tickets")
        .select("id, number, title")
        .in("id", ticketIds);
      if (error) throw fromDbError(error);
      for (const ticket of data) tickets.set(ticket.id, ticket);
    }

    // Korak 2: imena aktera (pogled profile_summaries, bez emaila).
    const actors = await loadProfileSummaries(
      this.ctx.db,
      rows.map((row) => row.actor_id),
    );

    // Korak 3: oblik za API (camelCase).
    return rows.map((row) => {
      const ticket = row.ticket_id ? tickets.get(row.ticket_id) : undefined;
      return {
        id: row.id,
        type: row.type,
        ticketId: row.ticket_id,
        ticketNumber: ticket?.number ?? null,
        ticketTitle: ticket?.title ?? null,
        actorName: row.actor_id ? (actors.get(row.actor_id)?.fullName ?? null) : null,
        isRead: row.is_read,
        createdAt: row.created_at,
      };
    });
  }
}
