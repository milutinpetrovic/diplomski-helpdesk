/**
 * Fajl: src/components/admin/user-change.ts
 * Svrha: pravila za potvrdu izmene naloga na stranici /admin/users (UC-21):
 *   - ticketsFreedBy: koliko nerešenih zahteva će se vratiti u red posle izmene
 *     (isto pravilo kao u bazi, funkcija admin_update_user, korak 3)
 *   - needsConfirmation: da li pre slanja treba pitati „Da li ste sigurni?“
 * Čiste funkcije bez React-a, pa imaju unit test (tests/unit/admin-users.test.ts).
 * Koristi ga: UserTable.
 */
import type { AdminUpdateUserInput, AdminUser } from "@/lib/validation/admin";
import { STAFF_ROLES, type UserRole } from "@/types/domain";

/** Da li je uloga deo tima podrške (agent ili admin). */
function isStaff(role: UserRole): boolean {
  return (STAFF_ROLES as readonly UserRole[]).includes(role);
}

/**
 * Broj zahteva koji se vraćaju u red za preuzimanje.
 * Ulaz: nalog pre izmene (sa openAssignedCount) i izmena { role?, isActive? }.
 * Vraća: openAssignedCount ako član tima postaje korisnik ili se deaktivira, inače 0.
 */
export function ticketsFreedBy(
  user: Pick<AdminUser, "role" | "isActive" | "openAssignedCount">,
  change: AdminUpdateUserInput,
): number {
  if (!isStaff(user.role)) return 0;
  const nextRole = change.role ?? user.role;
  const nextActive = change.isActive ?? user.isActive;
  return nextRole === "customer" || !nextActive ? user.openAssignedCount : 0;
}

/**
 * Da li izmena traži potvrdu: deaktivacija uvek (nalog više ne može da se
 * prijavi), a promena uloge kad se zahtevi vraćaju u red.
 */
export function needsConfirmation(
  user: Pick<AdminUser, "role" | "isActive" | "openAssignedCount">,
  change: AdminUpdateUserInput,
): boolean {
  return change.isActive === false || ticketsFreedBy(user, change) > 0;
}
