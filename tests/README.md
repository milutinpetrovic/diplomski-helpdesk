# tests — testovi

`unit/` (Vitest), `integration/` (Vitest + lokalni Supabase, uključujući RLS testove), `e2e/` (Playwright). Plan: `docs/07-uputstvo-za-implementaciju.md`, Faza 9.

Testovi baze (Faza 2) su u `integration/`: prijavljuju se kao demo nalozi iz `supabase/seed.sql` i proveravaju RLS, RPC funkcije i tabelu prelaza statusa. Pokretanje: `pnpm db:start`, pa `pnpm test:db` (adrese i ključeve čita iz `supabase status`). U CI-ju ih pokreće posao `db` (`.github/workflows/ci.yml`).

Faza 4: `integration/auth-api.test.ts` poziva API rute za prijavu i profil nad pravim lokalnim Supabase-om — registracija, potvrda emaila preko pravog emaila iz Mailpit-a, prijava, reset lozinke, odjava, `GET/PATCH /api/me` i početak Google prijave. Kolačiće (koje inače daje Next.js) zamenjuje mala „tegla kolačića“ u testu. Unit testovi: Zod šeme (`auth-validation`), greške Supabase Auth-a (`auth-errors`), zaštita stranica i meni po ulozi (`route-access`), i provera da je svaka API ruta u Swagger-u (`openapi`).

Faza 5a: `integration/tickets-api.test.ts` prolazi ceo tok zahteva kroz API rute (Bearer token, kao Swagger): korisnik kreira zahtev, agent ga preuzima, piše internu belešku i javni odgovor, traži informacije, korisnik odgovara (automatski povratak u obradu), agent rešava, korisnik ocenjuje i potvrđuje; proverava i da korisnik ne vidi internu belešku, vremenske oznake (`firstResponseAt`, `resolvedAt`, `closedAt`), filtere, pretragu, paginaciju, kategorije i spisak agenata. Unit testovi: tabela prelaza statusa za svaki red i svaku ulogu (`status-transitions`), prava nad zahtevom i polje `permissions` (`ticket-access`), Zod šeme i pretraga (`ticket-validation`).
