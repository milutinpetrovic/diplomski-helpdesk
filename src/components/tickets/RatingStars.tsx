/**
 * Fajl: src/components/tickets/RatingStars.tsx
 * Svrha: prikaz date ocene zadovoljstva (CSAT, FZ-16) kao 1–5 popunjenih
 * zvezdica, sa tekstom za čitač ekrana („4 od 5“) i opcionim komentarom.
 * Koristi ga: stranica /tickets/[id] (kad je zahtev već ocenjen).
 * Povezano sa: RatingForm (davanje ocene), TicketDetail.rating.
 */
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TicketRating } from "@/lib/validation/ratings";
import { cn } from "@/lib/utils";

/** Pet zvezdica, popunjeno onoliko koliko je ocena. Ulaz: ocena (score 1–5, komentar). */
export function RatingStars({ rating }: { rating: TicketRating }) {
  const t = useTranslations("tickets.rating");
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((value) => (
          <Star
            key={value}
            aria-hidden="true"
            className={cn(
              "size-5",
              value <= rating.score ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40",
            )}
          />
        ))}
        <span className="ml-2 text-sm text-muted-foreground">
          {t("value", { score: rating.score })}
        </span>
      </p>
      {rating.comment ? (
        <p className="text-sm break-words whitespace-pre-wrap">„{rating.comment}“</p>
      ) : null}
    </div>
  );
}
