/**
 * Pomoćne funkcije za testove RLS matrice (tests/integration/rls/).
 *
 * Testovi u ovom folderu pričaju DIREKTNO sa bazom (PostgREST), kao prijavljeni
 * korisnik, a ne preko API-ja aplikacije. Tako dokazuju da baza sama brani
 * podatke i kad bi neko zaobišao API (npr. pozvao Supabase ključem iz pregledača).
 * Svaki fajl odgovara jednom redu matrice iz docs/02-baza-podataka.md, sekcija 8,
 * a nazivi testova počinju oznakom ćelije (npr. "SELECT · korisnik"), pa se
 * izveštaj docs/08-testiranje.md može čitati uz tabelu.
 *
 * Dva načina na koja baza kaže „ne“:
 *   - nema prava nad tabelom ili kolonom (GRANT) ili novi red ne prolazi
 *     politiku: greška 42501 („permission denied“ / „row-level security“)
 *   - politika filtrira redove (SELECT, UPDATE, DELETE): nema greške, ali
 *     poziv ne vidi i ne menja nijedan red
 */
import { randomUUID } from "node:crypto";
import { expect } from "vitest";

import { as, serviceClient, signInAs, type DbClient, type SeedUser } from "../helpers";

/** Uloge iz matrice i demo nalog koji ih predstavlja. */
export const ROLE_USERS = {
  customer: "ana",
  agent: "agent",
  admin: "admin",
} as const satisfies Record<string, SeedUser>;

/** Oblik odgovora supabase-js poziva (dovoljan za proveru prava). */
type DbResponse = { data: unknown; error: { code?: string; message: string } | null };

/**
 * Proverava da baza odbija poziv zbog prava (kod greške 42501).
 * Koristi se za: gosta, direktan INSERT/UPDATE/DELETE bez GRANT-a, kolone
 * koje uloga ne sme da menja i novi red koji ne prolazi politiku.
 */
export async function expectPermissionDenied(call: PromiseLike<DbResponse>): Promise<void> {
  const { error } = await call;
  expect(error, "očekivana greška 42501 (nema prava)").not.toBeNull();
  expect(error?.code).toBe("42501");
}

/**
 * Proverava da politika filtrira redove: poziv uspeva, ali ne vidi (SELECT)
 * ili ne menja/briše (UPDATE/DELETE sa .select()) nijedan red.
 */
export async function expectNoRows(call: PromiseLike<DbResponse>): Promise<void> {
  const { data, error } = await call;
  expect(error, error?.message).toBeNull();
  expect(data).toEqual([]);
}

/**
 * Vraća redove koje poziv vidi (bez greške); test dalje proverava sadržaj.
 */
export async function visibleRows<T>(
  call: PromiseLike<{ data: T[] | null; error: DbResponse["error"] }>,
): Promise<T[]> {
  const { data, error } = await call;
  expect(error, error?.message).toBeNull();
  return data ?? [];
}

/** Privremeni nalog (uloga customer) i klijent prijavljen kao on. */
export interface TempUser {
  id: string;
  email: string;
  client: DbClient;
}

/**
 * Pravi privremeni nalog uloge customer (service_role, samo priprema podataka)
 * i prijavljuje ga. Brisanje: deleteTempUsers u afterAll.
 */
export async function createTempUser(created: string[]): Promise<TempUser> {
  // Korak 1: nalog u auth.users; triger handle_new_user pravi profil.
  const email = `rls-${randomUUID()}@helpdesk.test`;
  const password = "Privremena123!";
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "RLS Test" },
  });
  if (error || !data.user) throw new Error(`Nalog nije napravljen: ${error?.message}`);
  created.push(data.user.id);

  // Korak 2: prijava novog naloga.
  return { id: data.user.id, email, client: await signInAs(email, password) };
}

/** Briše privremene naloge (profil i zahtevi idu kaskadno ili ostaju bez vlasnika). */
export async function deleteTempUsers(ids: string[]): Promise<void> {
  for (const id of ids) await serviceClient().auth.admin.deleteUser(id);
}

/** Klijent za ulogu iz matrice (customer = Ana, agent = Jelena, admin). */
export function asRole(role: keyof typeof ROLE_USERS): Promise<DbClient> {
  return as(ROLE_USERS[role]);
}
