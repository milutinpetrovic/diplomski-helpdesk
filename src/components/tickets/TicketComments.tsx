/**
 * Fajl: src/components/tickets/TicketComments.tsx
 * Svrha: komentari na zahtevu, od najstarijeg ka najnovijem (UC-11), i forma
 * za novi komentar ispod njih. Interne beleške (vidi ih samo tim podrške)
 * imaju žutu pozadinu i oznaku „Interna beleška“. Korisnik ih uopšte ne dobija
 * iz baze (RLS), pa ih ne može videti ni ovde ni kroz API.
 * Koristi ga: stranica /tickets/[id]. Serverska komponenta (forma je klijentska).
 * Povezano sa: CommentService.list, CommentForm.
 */
import { Lock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { CommentForm } from "@/components/tickets/CommentForm";
import type { CommentWithAuthor } from "@/lib/validation/comments";
import { cn } from "@/lib/utils";

/**
 * Lista komentara i forma.
 * Ulaz: ID zahteva, komentari, da li sme da komentariše (zatvoren zahtev ne
 * prima komentare) i da li sme da piše internu belešku.
 */
export function TicketComments({
  ticketId,
  comments,
  canComment,
  canCommentInternal,
}: {
  ticketId: string;
  comments: CommentWithAuthor[];
  canComment: boolean;
  canCommentInternal: boolean;
}) {
  const t = useTranslations("tickets.comments");
  const format = useFormatter();

  return (
    <section aria-labelledby="comments-title" className="flex flex-col gap-4">
      <h2 id="comments-title" className="text-lg font-semibold">
        {t("title")} <span className="text-muted-foreground">({comments.length})</span>
      </h2>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={cn(
                "rounded-lg border p-3",
                comment.isInternal && "border-amber-500/50 bg-amber-50 dark:bg-amber-950/30",
              )}
            >
              {/* Autor, uloga i vreme. */}
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium">
                  {comment.author?.fullName ?? t("unknownAuthor")}
                </span>
                {comment.isInternal ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                    <Lock className="size-3" aria-hidden="true" />
                    {t("internal")}
                  </span>
                ) : null}
                <time dateTime={comment.createdAt} className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(comment.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </div>
              {/* Tekst komentara: čuvaju se novi redovi koje je autor uneo. */}
              <p className="text-sm break-words whitespace-pre-wrap">{comment.body}</p>
            </li>
          ))}
        </ol>
      )}

      {canComment ? (
        <CommentForm ticketId={ticketId} canCommentInternal={canCommentInternal} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("closed")}</p>
      )}
    </section>
  );
}
