/**
 * Priprema env promenljivih za integracione testove (Vitest setupFiles).
 *
 * Ako adresa i ključevi lokalnog Supabase-a nisu već postavljeni (u CI-ju ih
 * postavlja posao `db`), čita ih iz komande `supabase status -o env`, pa je
 * lokalno dovoljno: `pnpm db:start`, zatim `pnpm test:db`.
 */
import { execSync } from "node:child_process";

// Korak 1: ako je env već postavljen, ne radimo ništa.
if (!process.env.API_URL) {
  // Korak 2: izlaz komande ima redove oblika KLJUČ="vrednost".
  const output = execSync("pnpm exec supabase status -o env", { encoding: "utf8" });
  for (const line of output.split("\n")) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match?.[1] && match[2] !== undefined) process.env[match[1]] ??= match[2];
  }
}
