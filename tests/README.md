# tests — testovi

`unit/` (Vitest), `integration/` (Vitest + lokalni Supabase, uključujući RLS testove), `e2e/` (Playwright). Plan: `docs/07-uputstvo-za-implementaciju.md`, Faza 9.

Testovi baze (Faza 2) su u `integration/`: prijavljuju se kao demo nalozi iz `supabase/seed.sql` i proveravaju RLS, RPC funkcije i tabelu prelaza statusa. Pokretanje: `pnpm db:start`, pa `pnpm test:db` (adrese i ključeve čita iz `supabase status`). U CI-ju ih pokreće posao `db` (`.github/workflows/ci.yml`).
