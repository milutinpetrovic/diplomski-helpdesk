/**
 * Fajl: src/app/(app)/tickets/[id]/page.tsx
 * Svrha: stranica /tickets/[id] — detalji jednog zahteva (UC-11) i sve radnje nad njim:
 *   - zaglavlje: broj, naslov, status i prioritet
 *   - opis, komentari i forma za komentar (UC-12, UC-18)
 *   - bočni deo: podaci o zahtevu, akcije (preuzmi, dodeli, promeni status;
 *     UC-13, UC-16, UC-17, UC-20), ocena (UC-14) i istorija promena (FZ-9)
 * Podaci se čitaju na serveru preko istih servisa kao API rute; izmene idu
 * kroz API (klijentske komponente), pa se stranica osveži (router.refresh).
 * Pristup: customer (samo svoj zahtev), agent, admin. Zahtev koji ne postoji
 * ili nije dostupan prikazuje stranicu „Zahtev nije pronađen“ (not-found.tsx).
 * Povezano sa: TicketService, CommentService, UserAdminService, CategoryService.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { RatingForm } from "@/components/tickets/RatingForm";
import { RatingStars } from "@/components/tickets/RatingStars";
import { TicketActions } from "@/components/tickets/TicketActions";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/tickets/TicketBadges";
import { TicketComments } from "@/components/tickets/TicketComments";
import { TicketHistory } from "@/components/tickets/TicketHistory";
import { categoryName } from "@/components/tickets/ticket-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketLiveRefresh } from "@/components/notifications/LiveRefresh";
import { requireCurrentUser, type CurrentUser } from "@/lib/auth/server-session";
import { AppError } from "@/lib/errors/app-error";
import { uuidSchema } from "@/lib/validation/common";
import type { TicketDetail } from "@/lib/validation/tickets";
import { UserAdminService } from "@/services/admin/user-admin-service";
import { CategoryService } from "@/services/categories/category-service";
import { CommentService } from "@/services/comments/comment-service";
import { TicketService } from "@/services/tickets/ticket-service";

/**
 * Učitava zahtev ili prikazuje „Zahtev nije pronađen“.
 * Neispravan ID u adresi i zahtev bez pristupa (TICKET_NOT_FOUND) daju isti
 * odgovor, da se ne otkriva da tuđi zahtev postoji.
 */
async function loadTicket(user: CurrentUser, id: string): Promise<TicketDetail> {
  if (!uuidSchema.safeParse(id).success) notFound();
  try {
    return await new TicketService(user.ctx).getById(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "TICKET_NOT_FOUND") notFound();
    throw error;
  }
}

/** Naslov taba: „#1001 Ne radi štampač…“. */
export async function generateMetadata({ params }: PageProps<"/tickets/[id]">) {
  const user = await requireCurrentUser();
  const ticket = await loadTicket(user, (await params).id);
  return { title: `#${ticket.number} ${ticket.title}` };
}

/** Stranica zahteva (serverska komponenta). */
export default async function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  const user = await requireCurrentUser();
  const { ctx, profile } = user;
  const t = await getTranslations();
  const format = await getFormatter();
  const locale = await getLocale();

  // Korak 1: zahtev (sa dozvolama za prijavljenog korisnika).
  const ticket = await loadTicket(user, (await params).id);
  const isAdmin = profile.role === "admin";

  // Korak 2: komentari, istorija, kategorije (za nazive u istoriji) i — samo
  // adminu koji sme da dodeljuje — spisak tima, paralelno.
  const categoryService = new CategoryService(ctx);
  const [comments, history, categories, agents] = await Promise.all([
    new CommentService(ctx).list(ticket.id),
    new TicketService(ctx).getHistory(ticket.id),
    isAdmin ? categoryService.listAll() : categoryService.listActive(),
    isAdmin && ticket.permissions.canAssign
      ? new UserAdminService(ctx).listAgents()
      : Promise.resolve([]),
  ]);

  /** Datum i vreme za prikaz. */
  const formatDate = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });

  // Podaci o zahtevu za bočni deo (ime: vrednost).
  const details: [string, string][] = [
    [t("tickets.detail.creator"), ticket.creator?.fullName ?? "—"],
    [t("tickets.detail.assignee"), ticket.assignee?.fullName ?? t("tickets.list.unassigned")],
    [
      t("tickets.detail.category"),
      categoryName(ticket.category, locale) ?? t("tickets.list.noCategory"),
    ],
    [t("tickets.detail.createdAt"), formatDate(ticket.createdAt)],
    [t("tickets.detail.updatedAt"), formatDate(ticket.updatedAt)],
  ];
  if (ticket.resolvedAt)
    details.push([t("tickets.detail.resolvedAt"), formatDate(ticket.resolvedAt)]);
  if (ticket.closedAt) details.push([t("tickets.detail.closedAt"), formatDate(ticket.closedAt)]);

  return (
    <>
      {/* Real-time: komentari, status i dodela drugih se vide bez reload-a (FZ-13). */}
      <TicketLiveRefresh ticketId={ticket.id} userId={profile.id} />
      {/* Povratak na listu i zaglavlje zahteva. */}
      <Link
        href="/tickets"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("tickets.detail.back")}
      </Link>
      <div className="mb-6 flex flex-col gap-2">
        <p className="font-mono text-sm text-muted-foreground">#{ticket.number}</p>
        <h1 className="text-2xl font-semibold tracking-tight break-words">{ticket.title}</h1>
        <div className="flex flex-wrap gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
      </div>

      {/*
        Raspored: na računaru dve kolone (sadržaj levo; akcije, ocena, podaci i
        istorija desno). Na telefonu jedna kolona, a akcije su odmah ispod
        zaglavlja, da se ne traže na dnu stranice.
      */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card className="lg:col-start-2 lg:row-start-1">
          <CardHeader>
            <CardTitle>
              <h2>{t("tickets.actions.title")}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TicketActions
              ticket={ticket}
              currentUserId={profile.id}
              role={profile.role}
              agents={agents}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t("tickets.detail.description")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm break-words whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>
          <TicketComments
            ticketId={ticket.id}
            comments={comments}
            canComment={ticket.permissions.canComment}
            canCommentInternal={ticket.permissions.canCommentInternal}
          />
        </div>

        <aside className="flex flex-col gap-6 lg:col-start-2 lg:row-start-2">
          {/* Ocena: forma za vlasnika rešenog zahteva, ili već data ocena. */}
          {ticket.permissions.canRate || ticket.rating ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>{t("tickets.rating.title")}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ticket.rating ? (
                  <RatingStars rating={ticket.rating} />
                ) : (
                  <RatingForm ticketId={ticket.id} />
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t("tickets.detail.details")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {details.map(([name, value]) => (
                  <div key={name} className="contents">
                    <dt className="text-muted-foreground">{name}</dt>
                    <dd className="break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <TicketHistory entries={history} categories={categories} />
        </aside>
      </div>
    </>
  );
}
