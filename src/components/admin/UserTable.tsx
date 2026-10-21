/**
 * Fajl: src/components/admin/UserTable.tsx
 * Svrha: lista naloga na stranici /admin/users (UC-21, FZ-3). U svakom redu:
 *   - ime, email, uloga, status (aktivan/deaktiviran) i broj nerešenih
 *     dodeljenih zahteva (za članove tima)
 *   - promena uloge (padajuća lista + „Sačuvaj“) i „Deaktiviraj“ / „Aktiviraj“
 *   - sopstveni red je zaključan, uz napomenu (isto pravilo proverava i baza)
 * Pre deaktivacije i pre promene posle koje se zahtevi vraćaju u red pojavljuje
 * se dijalog za potvrdu („Jelena ima 3 nerešena zahteva. Biće vraćeni u red…“).
 * Na telefonu je svaki nalog kartica, na računaru jedan red (NFZ-1).
 * Koristi ga: stranica /admin/users. Klijentska komponenta. Uloga: admin.
 * Povezano sa: PATCH /api/admin/users/{id}, user-change.ts (pravila potvrde),
 * useApiAction (poruka + osvežavanje stranice).
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { needsConfirmation, ticketsFreedBy } from "@/components/admin/user-change";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useApiAction } from "@/hooks/use-api-action";
import type { AdminUpdateUserInput, AdminUser } from "@/lib/validation/admin";
import { USER_ROLES, type UserRole } from "@/types/domain";

/** Izmena koja čeka potvrdu u dijalogu. */
interface PendingChange {
  user: AdminUser;
  change: AdminUpdateUserInput;
}

/**
 * Lista naloga.
 * Ulaz: nalozi na ovoj strani i ID prijavljenog admina (njegov red je zaključan).
 */
export function UserTable({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  const t = useTranslations();
  const { run, pending } = useApiAction();
  const [confirming, setConfirming] = useState<PendingChange | null>(null);

  /** Slanje izmene: PATCH /api/admin/users/{id}, pa poruka i osvežavanje liste. */
  async function send(user: AdminUser, change: AdminUpdateUserInput) {
    const message =
      change.isActive === false
        ? t("admin.users.deactivated", { name: user.fullName })
        : change.isActive === true
          ? t("admin.users.activated", { name: user.fullName })
          : t("admin.users.roleChanged", {
              name: user.fullName,
              role: t(`roles.${change.role ?? user.role}`),
            });
    const ok = await run((api) => api.patch(`/admin/users/${user.id}`, change), message);
    if (ok) setConfirming(null);
  }

  /** Klik na „Sačuvaj“ / „Deaktiviraj“ / „Aktiviraj“: prvo potvrda ako je potrebna. */
  function request(user: AdminUser, change: AdminUpdateUserInput) {
    if (needsConfirmation(user, change)) setConfirming({ user, change });
    else void send(user, change);
  }

  return (
    <>
      <ul
        className="flex flex-col divide-y rounded-lg border"
        aria-label={t("admin.users.caption")}
      >
        {users.map((user) => (
          <UserRow
            // key sa ulogom: posle uspešne izmene padajuća lista kreće od nove uloge.
            key={`${user.id}-${user.role}`}
            user={user}
            isSelf={user.id === currentUserId}
            pending={pending}
            onRequest={(change) => request(user, change)}
          />
        ))}
      </ul>

      {/* Potvrda pre deaktivacije ili oslobađanja zahteva. */}
      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        {confirming ? (
          <ConfirmContent
            {...confirming}
            pending={pending}
            onConfirm={() => void send(confirming.user, confirming.change)}
            onCancel={() => setConfirming(null)}
          />
        ) : null}
      </Dialog>
    </>
  );
}

/**
 * Jedan nalog u listi.
 * Ulaz: nalog, da li je to prijavljeni admin, da li poziv traje i funkcija
 * koja prima željenu izmenu.
 */
function UserRow({
  user,
  isSelf,
  pending,
  onRequest,
}: {
  user: AdminUser;
  isSelf: boolean;
  pending: boolean;
  onRequest: (change: AdminUpdateUserInput) => void;
}) {
  const t = useTranslations("admin.users");
  const tRoles = useTranslations("roles");
  const [role, setRole] = useState<UserRole>(user.role);
  const roleSelectId = `role-${user.id}`;
  const locked = isSelf || pending;

  // Red u jednoj liniji (kolone) tek od širine lg: na tabletu bočni meni
  // zauzima deo ekrana, pa četiri kolone ne staju i red ide jedno ispod drugog.
  return (
    <li className="flex flex-col gap-3 p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem_9rem_9rem] lg:items-center lg:gap-4">
      {/* Ime, email i status. */}
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="truncate">{user.fullName}</span>
          {isSelf ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {t("selfBadge")}
            </span>
          ) : null}
          {!user.isActive ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {t("statusInactive")}
            </span>
          ) : null}
        </p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        {isSelf ? <p className="mt-1 text-xs text-muted-foreground">{t("self")}</p> : null}
      </div>

      {/* Uloga: izbor i „Sačuvaj“ (dugme radi tek kad se uloga promeni). */}
      <form
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          onRequest({ role });
        }}
      >
        <Label htmlFor={roleSelectId} className="text-xs text-muted-foreground">
          {t("columns.role")}
        </Label>
        <div className="flex gap-2">
          <NativeSelect
            id={roleSelectId}
            value={role}
            disabled={locked}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            {USER_ROLES.map((option) => (
              <option key={option} value={option}>
                {tRoles(option)}
              </option>
            ))}
          </NativeSelect>
          <Button
            type="submit"
            variant="outline"
            disabled={locked || role === user.role}
            aria-label={t("saveRoleFor", { name: user.fullName })}
          >
            {t("saveRole")}
          </Button>
        </div>
      </form>

      {/* Dodeljeni nerešeni zahtevi (samo za tim; korisnik ih nema). */}
      <p className="text-sm text-muted-foreground">
        {user.role === "customer" ? null : t("openTickets", { count: user.openAssignedCount })}
      </p>

      {/* Aktivnost naloga. */}
      <Button
        variant={user.isActive ? "outline" : "secondary"}
        disabled={locked}
        onClick={() => onRequest({ isActive: !user.isActive })}
        aria-label={
          user.isActive
            ? t("deactivateFor", { name: user.fullName })
            : t("activateFor", { name: user.fullName })
        }
        className="lg:justify-self-end"
      >
        {user.isActive ? t("deactivate") : t("activate")}
      </Button>
    </li>
  );
}

/**
 * Sadržaj dijaloga za potvrdu: šta se menja i koliko zahteva se vraća u red.
 * Ulaz: nalog, izmena, da li poziv traje, „Potvrdi“ i „Odustani“.
 */
function ConfirmContent({
  user,
  change,
  pending,
  onConfirm,
  onCancel,
}: PendingChange & { pending: boolean; onConfirm: () => void; onCancel: () => void }) {
  const t = useTranslations();
  const freed = ticketsFreedBy(user, change);
  const deactivating = change.isActive === false;

  return (
    <DialogContent closeLabel={t("common.closeDialog")}>
      <DialogHeader>
        <DialogTitle>
          {deactivating
            ? t("admin.users.confirm.titleDeactivate", { name: user.fullName })
            : t("admin.users.confirm.titleRole", { name: user.fullName })}
        </DialogTitle>
        <DialogDescription>
          {deactivating
            ? t("admin.users.confirm.deactivateText", { name: user.fullName })
            : t("admin.users.confirm.roleText", { role: t(`roles.${change.role ?? user.role}`) })}
        </DialogDescription>
      </DialogHeader>
      {freed > 0 ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {t("admin.users.confirm.openTickets", { name: user.fullName, count: freed })}
        </p>
      ) : null}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t("admin.users.confirm.cancel")}
        </Button>
        <Button
          variant={deactivating ? "destructive" : "default"}
          disabled={pending}
          onClick={onConfirm}
        >
          {deactivating
            ? t("admin.users.confirm.confirmDeactivate")
            : t("admin.users.confirm.confirmRole")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
