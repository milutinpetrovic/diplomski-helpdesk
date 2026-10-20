/**
 * Fajl: src/components/tickets/CommentForm.tsx
 * Svrha: forma za novi komentar na zahtevu (UC-12, UC-18). Tim podrške ima i
 * prekidač „Interna beleška“: takav komentar vidi samo tim, korisnik ne
 * (FZ-8; to obezbeđuju i API i RLS u bazi, ne samo ovaj prekidač).
 * Tok: Zod provera (addCommentSchema, ista kao u API-ju) ->
 * POST /api/tickets/{id}/comments -> poruka -> prazna forma i osvežena lista.
 * Koristi ga: TicketComments (stranica /tickets/[id]). Klijentska komponenta.
 * Povezano sa: CommentService.add, src/app/api/tickets/[id]/comments/route.ts.
 */
"use client";

import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { FormTextareaField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/button";
import { useApiAction } from "@/hooks/use-api-action";
import { addCommentSchema, type AddCommentInput } from "@/lib/validation/comments";

/** Vrednosti forme pre Zod obrade (isInternal može da izostane). */
type CommentFormValues = z.input<typeof addCommentSchema>;

/**
 * Forma za komentar.
 * Ulaz: ID zahteva i da li prijavljeni sme da piše internu belešku (permissions.canCommentInternal).
 * Uloge: customer (samo javni komentar), agent i admin.
 */
export function CommentForm({
  ticketId,
  canCommentInternal,
}: {
  ticketId: string;
  canCommentInternal: boolean;
}) {
  const t = useTranslations("tickets.comments");
  const { run, pending } = useApiAction();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CommentFormValues, unknown, AddCommentInput>({
    resolver: zodResolver(addCommentSchema),
    defaultValues: { body: "", isInternal: false },
  });
  // Trenutna vrednost prekidača (za boju polja); useWatch radi i sa React Compiler-om.
  const isInternal = useWatch({ control, name: "isInternal" });

  /** Slanje komentara; posle uspeha forma se prazni. */
  async function onSubmit(values: AddCommentInput) {
    const ok = await run(
      (api) => api.post(`/tickets/${ticketId}/comments`, values),
      values.isInternal ? t("noteAdded") : t("added"),
    );
    if (ok) reset({ body: "", isInternal: false });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <FormTextareaField
        id="comment-body"
        label={t("label")}
        placeholder={t("placeholder")}
        rows={4}
        maxLength={5000}
        errorKey={errors.body?.message}
        // Interna beleška ima drugu boju polja, da se ne pošalje greškom korisniku.
        className={isInternal ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30" : undefined}
        {...register("body")}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {canCommentInternal ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-amber-600"
              {...register("isInternal")}
            />
            <span>
              <span className="font-medium">{t("internal")}</span>
              <span className="block text-xs text-muted-foreground">{t("internalHint")}</span>
            </span>
          </label>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
