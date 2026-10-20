/**
 * Fajl: src/lib/auth/server-session.ts
 * Svrha: ko je prijavljen — za SERVERSKE STRANICE (Server Components i layout-e).
 * API rute za to koriste withApi; stranice koriste ove funkcije, koje rade
 * istu proveru (AuthGuard) i daju ServiceContext za čitanje preko servisa.
 * Koriste ga: src/app/(app)/layout.tsx (zaglavlje i meni), /profile,
 * provera uloge za /admin i /analytics.
 * Povezano sa: auth-guard.ts, ProfileService, proxy.ts (proxy samo preusmerava
 * goste; uloga i aktivnost naloga se proveravaju ovde, na serveru).
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getAuthContext } from "@/lib/auth/auth-guard";
import { AppError } from "@/lib/errors/app-error";
import { getRealtimePublisher } from "@/lib/realtime";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/validation/profile";
import { ProfileService } from "@/services/profile/profile-service";
import type { ServiceContext } from "@/services/service-context";
import type { UserRole } from "@/types/domain";

/** Prijavljeni korisnik na serverskoj stranici. */
export interface CurrentUser {
  /** Kontekst za servise (isti oblik kao u API rutama). */
  ctx: ServiceContext;
  /** Profil korisnika (ime, uloga, jezik...). */
  profile: Profile;
}

/**
 * Vraća prijavljenog korisnika, null ako niko nije prijavljen, ili "disabled"
 * ako je nalog deaktiviran.
 * cache(): u okviru jednog zahteva poziva se samo jednom, iako ga koriste i
 * layout i stranica.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | "disabled" | null> => {
  // Korak 0: stranica sa korisnikom se iscrtava tek za stvaran zahtev, nikad unapred
  // (ni kao „prefetch“): Supabase klijent koristi trenutno vreme (Date.now()) za
  // proveru isteka tokena, a Next.js to ne dozvoljava pri unapred pripremljenom prikazu.
  await connection();

  // Korak 1: Supabase klijent iz kolačića sesije.
  const db = await createServerSupabaseClient();
  try {
    // Korak 2: provera sesije i uloge (isto kao za API rute).
    const auth = await getAuthContext({ db, accessToken: null });
    if (!auth) return null;

    // Korak 3: ceo profil za prikaz (ime, email...).
    const ctx: ServiceContext = { db, auth, publisher: getRealtimePublisher(db) };
    const profile = await new ProfileService(ctx).getMe();
    return { ctx, profile };
  } catch (error) {
    if (error instanceof AppError && error.code === "ACCOUNT_DISABLED") return "disabled";
    throw error;
  }
});

/**
 * Zahteva prijavljenog i aktivnog korisnika na stranici.
 * Gost ide na /login, a deaktiviran nalog na /login sa porukom o grešci.
 * Vraća: prijavljenog korisnika.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user === null) redirect("/login");
  if (user === "disabled") redirect("/login?error=ACCOUNT_DISABLED");
  return user;
}

/**
 * Proverava da li prijavljeni korisnik ima jednu od datih uloga (RBAC za stranice).
 * Vraća: korisnika ako ima ulogu, ili null (stranica tada prikazuje „Nemate pristup“).
 */
export async function requirePageRole(roles: readonly UserRole[]): Promise<CurrentUser | null> {
  const user = await requireCurrentUser();
  return roles.includes(user.profile.role) ? user : null;
}
