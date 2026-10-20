/**
 * Pomoćne funkcije za integracione testove baze (Vitest + lokalni Supabase).
 *
 * Šta je ovde:
 *   - čitanje adrese i ključeva lokalnog Supabase-a iz env promenljivih
 *   - prijava demo naloga iz supabase/seed.sql (svaki test radi "kao" neka uloga)
 *   - pravljenje zahteva u željenom statusu (preko admin naloga)
 *   - provera da je RPC funkcija vratila očekivani kod greške
 *
 * Testovi se pokreću komandom `pnpm test:db`, posle `supabase start`
 * (lokalno) ili u CI poslu `db` (.github/workflows/ci.yml).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect } from "vitest";
import type { Database } from "@/types/database";

/** Klijent sa tipovima generisanim iz baze (pnpm db:types). */
export type DbClient = SupabaseClient<Database>;

/** Lozinka svih demo naloga iz supabase/seed.sql. */
export const SEED_PASSWORD = "Lozinka123!";

/** Fiksni ID-jevi i emailovi demo naloga (isti kao u supabase/seed.sql). */
export const USERS = {
  admin: { id: "00000000-0000-4000-8000-000000000001", email: "admin@helpdesk.test" },
  agent: { id: "00000000-0000-4000-8000-000000000002", email: "agent@helpdesk.test" },
  agent2: { id: "00000000-0000-4000-8000-000000000003", email: "agent2@helpdesk.test" },
  ana: { id: "00000000-0000-4000-8000-000000000004", email: "ana@helpdesk.test" },
  marko: { id: "00000000-0000-4000-8000-000000000005", email: "marko@helpdesk.test" },
} as const;

/** Naziv demo naloga (ključ u USERS). */
export type SeedUser = keyof typeof USERS;

/** ID kategorije "Tehnički problem" iz seed-a. */
export const CATEGORY_ID = "10000000-0000-4000-8000-000000000001";

/** Status zahteva (isti kao enum ticket_status u bazi). */
export type TicketStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";

/**
 * Čita obaveznu env promenljivu; prihvata više naziva jer `supabase status -o env`
 * koristi API_URL / ANON_KEY / SERVICE_ROLE_KEY, a aplikacija NEXT_PUBLIC_* nazive.
 */
function readEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Nedostaje env promenljiva: ${names.join(" ili ")}. Pokreni "supabase start".`);
}

const SUPABASE_URL = readEnv("API_URL", "NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = readEnv("ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = readEnv("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

/** Opcije klijenta za testove: bez čuvanja sesije između testova. */
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

/** Klijent bez prijave (gost, uloga baze `anon`). */
export function anonClient(): DbClient {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, clientOptions);
}

/**
 * Klijent sa service_role ključem: zaobilazi RLS. Koristi se SAMO u testovima
 * za pripremu podataka (npr. novi nalog), nikad za proveru prava.
 */
export function serviceClient(): DbClient {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, clientOptions);
}

/** Keš prijavljenih klijenata, da se svaki nalog prijavljuje samo jednom. */
const signedIn = new Map<string, DbClient>();

/**
 * Prijavljuje nalog emailom i lozinkom i vraća klijenta koji radi u njegovo ime
 * (auth.uid() u bazi = ID tog naloga).
 */
export async function signInAs(email: string, password = SEED_PASSWORD): Promise<DbClient> {
  const cached = signedIn.get(email);
  if (cached) return cached;

  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, clientOptions);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Prijava nije uspela za ${email}: ${error.message}`);

  signedIn.set(email, client);
  return client;
}

/** Skraćenica: klijent za demo nalog po nazivu (npr. as("ana")). */
export function as(user: SeedUser): Promise<DbClient> {
  return signInAs(USERS[user].email);
}

/** Oblik odgovora supabase-js poziva (data ili error). */
type DbResult = { error: { message: string; code?: string } | null };

/**
 * Proverava da je poziv baze završen greškom sa očekivanim kodom
 * (message iz `raise exception using message = '<KOD>'`).
 */
export async function expectDbError(call: PromiseLike<DbResult>, code: string): Promise<void> {
  const { error } = await call;
  expect(error, `očekivana greška ${code}`).not.toBeNull();
  expect(error?.message).toBe(code);
}

/** Proverava da je poziv baze uspeo, kad poziv ne vraća podatke (npr. update bez select). */
export async function expectNoDbError(call: PromiseLike<DbResult>): Promise<void> {
  const { error } = await call;
  expect(error, error?.message).toBeNull();
}

/** Proverava da je poziv baze uspeo (bez greške, sa podacima) i vraća podatke. */
export async function expectDbOk<T>(
  call: PromiseLike<{ data: T; error: DbResult["error"] }>,
): Promise<NonNullable<T>> {
  const { data, error } = await call;
  expect(error, error?.message).toBeNull();
  expect(data).not.toBeNull();
  return data as NonNullable<T>;
}

/** Red tabele tickets (samo kolone koje testovi koriste). */
export interface TicketRow {
  id: string;
  number: number;
  title: string;
  status: TicketStatus;
  priority: string;
  created_by: string;
  assigned_to: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
}

/** Brojač za jedinstvene naslove zahteva u testovima. */
let ticketCounter = 0;

/**
 * Pravi novi zahtev u ime korisnika (podrazumevano Ana) i vraća ga.
 * Status je `open`, zahtev je nedodeljen.
 */
export async function createTicket(owner: SeedUser = "ana"): Promise<TicketRow> {
  ticketCounter += 1;
  const client = await as(owner);
  return expectDbOk(
    client
      .rpc("create_ticket", {
        p_title: `Test zahtev ${ticketCounter}`,
        p_description: "Opis test zahteva za integracione testove.",
        p_category_id: CATEGORY_ID,
        p_priority: "medium",
      })
      .single<TicketRow>(),
  );
}

/**
 * Put kroz statuse do traženog statusa (radi ga admin, koji sme sve prelaze).
 * Zahtev se usput dodeljuje agentu `agent` (dodela prebacuje open -> in_progress).
 */
const PATH_TO_STATUS: Record<TicketStatus, TicketStatus[]> = {
  open: [],
  in_progress: [],
  waiting_on_customer: ["waiting_on_customer"],
  resolved: ["resolved"],
  closed: ["resolved", "closed"],
};

/**
 * Pravi zahtev (vlasnik Ana) i dovodi ga u traženi status. Za sve statuse
 * osim `open` zahtev je dodeljen agentu `agent`.
 */
export async function createTicketInStatus(status: TicketStatus): Promise<TicketRow> {
  const ticket = await createTicket("ana");
  if (status === "open") return ticket;

  const admin = await as("admin");
  let current = await expectDbOk(
    admin
      .rpc("assign_ticket", { p_ticket_id: ticket.id, p_assignee_id: USERS.agent.id })
      .single<TicketRow>(),
  );
  for (const next of PATH_TO_STATUS[status]) {
    current = await expectDbOk(
      admin
        .rpc("change_ticket_status", { p_ticket_id: ticket.id, p_new_status: next })
        .single<TicketRow>(),
    );
  }
  return current;
}
