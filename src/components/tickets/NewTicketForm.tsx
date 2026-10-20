/**
 * Fajl: src/components/tickets/NewTicketForm.tsx
 * Svrha: forma „Novi zahtev“ (UC-09): naslov, opis, kategorija i prioritet.
 * Tok: Zod provera (createTicketSchema, ista kao u API-ju) -> POST /api/tickets
 * -> poruka „Zahtev #1013 je poslat“ -> prelazak na stranicu novog zahteva.
 * Greške iz API-ja po poljima prikazuju se ispod polja, ostale iznad dugmeta.
 * Koristi ga: stranica /tickets/new. Uloga: customer.
 * Povezano sa: src/app/api/tickets/route.ts (POST), TicketService.create.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { FormAlert } from "@/components/forms/FormAlert";
import { FormField, FormSelectField, FormTextareaField } from "@/components/forms/FormField";
import { applyApiError } from "@/components/forms/apply-api-error";
import { categoryName } from "@/components/tickets/ticket-labels";
import { Button } from "@/components/ui/button";
import { useApiClient } from "@/hooks/use-api-client";
import type { ErrorCode } from "@/lib/errors/codes";
import type { Category } from "@/lib/validation/categories";
import {
  createTicketSchema,
  type CreateTicketInput,
  type TicketDetail,
} from "@/lib/validation/tickets";
import { TICKET_PRIORITIES } from "@/types/domain";

/** Vrednosti forme pre Zod obrade (prioritet može da izostane, šema dodaje "medium"). */
type NewTicketFormValues = z.input<typeof createTicketSchema>;

/** Polja forme, za prikaz grešaka iz API-ja ispod polja. */
const FIELDS = ["title", "description", "categoryId", "priority"] as const;

/** Forma za novi zahtev. Ulaz: aktivne kategorije. Uloga: customer. */
export function NewTicketForm({ categories }: { categories: Category[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const api = useApiClient();
  const router = useRouter();
  const [formError, setFormError] = useState<ErrorCode | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewTicketFormValues, unknown, CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { title: "", description: "", categoryId: "", priority: "medium" },
  });

  /** Slanje: POST /api/tickets, pa prelazak na stranicu novog zahteva. */
  async function onSubmit(values: CreateTicketInput) {
    setFormError(null);
    try {
      const ticket = await api.post<TicketDetail>("/tickets", values);
      toast.success(t("tickets.new.created", { number: ticket.number }));
      router.push(`/tickets/${ticket.id}`);
    } catch (error) {
      setFormError(applyApiError(error, setError, FIELDS));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormField
        id="title"
        label={t("tickets.fields.title")}
        hint={t("tickets.new.titleHint")}
        maxLength={150}
        errorKey={errors.title?.message}
        {...register("title")}
      />
      <FormTextareaField
        id="description"
        label={t("tickets.fields.description")}
        hint={t("tickets.new.descriptionHint")}
        rows={6}
        maxLength={5000}
        errorKey={errors.description?.message}
        {...register("description")}
      />
      {/* Kategorija i prioritet: jedno ispod drugog na telefonu, jedno pored drugog na računaru. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelectField
          id="categoryId"
          label={t("tickets.fields.category")}
          errorKey={errors.categoryId?.message}
          {...register("categoryId")}
        >
          <option value="" disabled>
            {t("tickets.new.categoryPlaceholder")}
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {categoryName(category, locale)}
            </option>
          ))}
        </FormSelectField>
        <FormSelectField
          id="priority"
          label={t("tickets.fields.priority")}
          errorKey={errors.priority?.message}
          {...register("priority")}
        >
          {TICKET_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {t(`ticketPriority.${priority}`)}
            </option>
          ))}
        </FormSelectField>
      </div>
      {formError ? <FormAlert>{t(`errors.${formError}`)}</FormAlert> : null}
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto sm:self-start">
        {t("tickets.new.submit")}
      </Button>
    </form>
  );
}
