/**
 * Fajl: src/lib/auth/auth-context.ts
 * Svrha: AuthContext — ko je prijavljeni korisnik i koja mu je uloga.
 * Pravi ga AuthGuard posle provere sesije i profila; servisi ga dobijaju
 * kroz ServiceContext i po njemu odlučuju šta korisnik sme (RBAC).
 * Povezano sa: docs/03-dijagram-klasa.md (klasa AuthContext), src/types/domain.ts.
 */
import type { Locale } from "@/lib/i18n/config";
import type { UserRole } from "@/types/domain";

/** Podaci o prijavljenom (aktivnom) korisniku. */
export class AuthContext {
  /**
   * Ulaz: ID korisnika (isti kao auth.uid() u bazi), uloga iz tabele profiles
   * i izabrani jezik iz profila.
   */
  constructor(
    readonly userId: string,
    readonly role: UserRole,
    readonly locale: Locale,
  ) {}

  /** Da li je korisnik član tima podrške (agent ili admin). */
  isStaff(): boolean {
    return this.role === "agent" || this.role === "admin";
  }

  /** Da li je korisnik administrator. */
  isAdmin(): boolean {
    return this.role === "admin";
  }

  /** Da li korisnik ima jednu od navedenih uloga. */
  hasRole(roles: readonly UserRole[]): boolean {
    return roles.includes(this.role);
  }
}
