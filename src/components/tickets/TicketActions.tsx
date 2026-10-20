/**
 * Fajl: src/components/tickets/TicketActions.tsx
 * Svrha: dugmad za akcije na stranici zahteva. Prikazuje se SAMO ono što
 * prijavljeni korisnik sme, po polju `permissions` iz TicketDetail (računa ga
 * TicketAccessPolicy na serveru):
 *   - agent: „Preuzmi zahtev“ (nedodeljen zahtev, UC-16)
 *   - admin: izbor člana tima ili „Nikome“ (UC-20)
 *   - promena statusa: po jedno dugme za svaki dozvoljeni prelaz (UC-13, UC-17);
 *     korisnik vidi „Otkaži zahtev“, „Potvrdi rešenje“ i „Ponovo otvori“
 * Sakrivanje dugmadi je samo udobnost: API i baza iste provere rade ponovo.
 * Koristi ga: stranica /tickets/[id]. Klijentska komponenta.
 * Povezano sa: POST /api/tickets/{id}/status i /assign, ticket-labels.ts (nazivi dugmadi).
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { transitionLabelKey, type TransitionLabelKey } from "@/components/tickets/ticket-labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useApiAction } from "@/hooks/use-api-action";
import type { AgentSummary } from "@/lib/validation/admin";
import type { TicketDetail } from "@/lib/validation/tickets";
import type { TicketStatus, UserRole } from "@/types/domain";

/** Vrednost u listi za dodelu koja znači „oslobodi zahtev“. */
const NOBODY = "";

/**
 * Izgled dugmeta prelaza: glavna akcija (reši, potvrdi) je istaknuta,
 * otkazivanje je samo okvir, ostalo sekundarno.
 */
function transitionVariant(labelKey: TransitionLabelKey): "default" | "outline" | "secondary" {
  if (labelKey === "resolve" || labelKey === "confirm") return "default";
  if (labelKey === "cancel") return "outline";
  return "secondary";
}

/**
 * Akcije nad zahtevom.
 * Ulaz: zahtev (sa dozvolama), ID i uloga prijavljenog i spisak tima (za admina).
 * Uloge: customer, agent, admin (svako vidi svoja dugmad).
 */
export function TicketActions({
  ticket,
  currentUserId,
  role,
  agents,
}: {
  ticket: Pick<TicketDetail, "id" | "status" | "assignedTo" | "permissions">;
  currentUserId: string;
  role: UserRole;
  agents: AgentSummary[];
}) {
  const t = useTranslations();
  const { run, pending } = useApiAction();
  const [assigneeId, setAssigneeId] = useState(ticket.assignedTo ?? NOBODY);
  // Otkazivanje traži potvrdu (korisnik posle ne može sam da ga vrati).
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const isCustomer = role === "customer";
  const { allowedTransitions, canAssign } = ticket.permissions;
  const canClaim = canAssign && role === "agent";
  const canPickAssignee = canAssign && role === "admin";

  /** Promena statusa: POST /api/tickets/{id}/status. */
  function changeStatus(status: TicketStatus) {
    setConfirmingCancel(false);
    void run(
      (api) => api.post(`/tickets/${ticket.id}/status`, { status }),
      t("tickets.actions.statusChanged", { status: t(`ticketStatus.${status}`) }),
    );
  }

  /** Dodela: POST /api/tickets/{id}/assign (agent šalje svoj ID, admin izabrani ili null). */
  function assign(id: string | null, message: string) {
    void run((api) => api.post(`/tickets/${ticket.id}/assign`, { assigneeId: id }), message);
  }

  // Nema nijedne akcije: kratka poruka umesto prazne kartice.
  if (!canClaim && !canPickAssignee && allowedTransitions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("tickets.actions.none")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Korisnik: objašnjenje kad tim označi zahtev kao rešen. */}
      {isCustomer && ticket.status === "resolved" ? (
        <p className="text-sm text-muted-foreground">{t("tickets.actions.resolvedHint")}</p>
      ) : null}

      {/* Agent: preuzimanje nedodeljenog zahteva. */}
      {canClaim ? (
        <Button
          disabled={pending}
          onClick={() => assign(currentUserId, t("tickets.actions.claimed"))}
        >
          {t("tickets.actions.claim")}
        </Button>
      ) : null}

      {/* Admin: izbor člana tima. */}
      {canPickAssignee ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            assign(assigneeId === NOBODY ? null : assigneeId, t("tickets.actions.assigned"));
          }}
        >
          <Label htmlFor="assignee">{t("tickets.actions.assignLabel")}</Label>
          <NativeSelect
            id="assignee"
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value={NOBODY}>{t("tickets.actions.assignNobody")}</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {t("tickets.actions.agentOption", {
                  name: agent.fullName,
                  count: agent.openAssignedCount,
                })}
              </option>
            ))}
          </NativeSelect>
          <Button
            type="submit"
            variant="outline"
            disabled={pending || assigneeId === (ticket.assignedTo ?? NOBODY)}
          >
            {t("tickets.actions.assignSubmit")}
          </Button>
        </form>
      ) : null}

      {/* Promena statusa: jedno dugme po dozvoljenom prelazu. */}
      {allowedTransitions.length > 0 ? (
        <div
          role="group"
          aria-label={t("tickets.actions.statusLabel")}
          className="flex flex-col gap-2"
        >
          {allowedTransitions.map((to) => {
            const labelKey = transitionLabelKey(ticket.status, to, isCustomer);

            // Otkazivanje: prvo pitanje „Da li sigurno…“, pa „Da, otkaži“ / „Ne“.
            if (labelKey === "cancel" && confirmingCancel) {
              return (
                <div key={to} role="alert" className="flex flex-col gap-2 rounded-md border p-3">
                  <p className="text-sm">{t("tickets.actions.cancelConfirm")}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => changeStatus(to)}
                    >
                      {t("tickets.actions.cancelYes")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmingCancel(false)}>
                      {t("tickets.actions.cancelNo")}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <Button
                key={to}
                variant={transitionVariant(labelKey)}
                disabled={pending}
                onClick={() =>
                  labelKey === "cancel" ? setConfirmingCancel(true) : changeStatus(to)
                }
              >
                {t(`tickets.transitions.${labelKey}`)}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
