/**
 * Fajl: src/components/tickets/RatingForm.tsx
 * Svrha: ocena zadovoljstva rešenim zahtevom (CSAT, UC-14, FZ-16): izbor 1–5
 * zvezdica i opcioni komentar. Ocena se daje jednom po zahtevu.
 * Zvezdice su obična radio dugmad (strelice na tastaturi menjaju izbor, čitač
 * ekrana čita „4 zvezdice“), a ikonice su samo izgled (NFZ-4).
 * Tok: Zod provera (rateTicketSchema) -> POST /api/tickets/{id}/rating -> „Hvala na oceni!“.
 * Koristi ga: stranica /tickets/[id], kad permissions.canRate. Uloga: customer (vlasnik).
 * Povezano sa: RatingService.rate, src/app/api/tickets/[id]/rating/route.ts.
 */
"use client";

import { useState, type FormEvent } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormTextareaField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { useApiAction } from "@/hooks/use-api-action";
import { rateTicketSchema } from "@/lib/validation/ratings";
import { cn } from "@/lib/utils";

/** Forma za ocenu. Ulaz: ID zahteva. */
export function RatingForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations();
  const { run, pending } = useApiAction();
  const [score, setScore] = useState(0);
  // Zvezdica iznad koje je miš (pregled pre klika); 0 = nijedna.
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [errorKey, setErrorKey] = useState<string | undefined>();
  const shown = hovered || score;

  /** Slanje ocene posle provere istom Zod šemom kao u API-ju. */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = rateTicketSchema.safeParse({ score, comment: comment || undefined });
    if (!parsed.success) {
      setErrorKey(parsed.error.issues[0]?.message);
      return;
    }
    setErrorKey(undefined);
    await run(
      (api) => api.post(`/tickets/${ticketId}/rating`, parsed.data),
      t("tickets.rating.thanks"),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={errorKey === "scoreRange" ? "rating-error" : undefined}
      >
        <legend className="mb-2 text-sm font-medium">{t("tickets.rating.prompt")}</legend>
        <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50"
              onMouseEnter={() => setHovered(value)}
            >
              <input
                type="radio"
                name="score"
                value={value}
                checked={score === value}
                onChange={() => setScore(value)}
                className="sr-only"
              />
              <Star
                aria-hidden="true"
                className={cn(
                  "size-8 transition-colors",
                  value <= shown ? "fill-amber-400 text-amber-500" : "text-muted-foreground/50",
                )}
              />
              <span className="sr-only">{t("tickets.rating.stars", { count: value })}</span>
            </label>
          ))}
        </div>
        {errorKey === "scoreRange" ? (
          <p id="rating-error" className="text-sm text-destructive">
            {t("validation.scoreRange")}
          </p>
        ) : null}
      </fieldset>
      <FormTextareaField
        id="rating-comment"
        label={t("tickets.rating.comment")}
        rows={3}
        maxLength={1000}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        errorKey={errorKey === "scoreRange" ? undefined : errorKey}
      />
      <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:self-start">
        {t("tickets.rating.submit")}
      </Button>
    </form>
  );
}
