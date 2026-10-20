/**
 * Fajl: src/lib/supabase/types.ts
 * Svrha: tip Supabase klijenta sa tipovima generisanim iz baze, zajednički
 * za server i pregledač.
 * Koriste ga: Supabase klijenti, servisi (ServiceContext), real-time sloj.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/** Supabase klijent sa tipovima baze (tabele, RPC funkcije, enumi). */
export type DbClient = SupabaseClient<Database>;
