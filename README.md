# Tehnička podrška — veb aplikacija (diplomski rad)

Veb aplikacija za prijavu, praćenje i rešavanje zahteva za tehničku podršku, napravljena u Next.js-u.
Diplomski rad: Milutin Petrović (3407), Fakultet informacionih tehnologija, Univerzitet Metropolitan Beograd.
Mentor: dr Nemanja Zdravković.

- Kontekst i pravila za razvoj: [`CLAUDE.md`](CLAUDE.md)
- Projektni dizajn (use case, baza, klase, dijagrami sekvenci, API, plan po fazama): [`docs/`](docs/README.md)

## Tehnologije

Next.js 16 (App Router), React 19, TypeScript 5.9 (strict), Tailwind CSS 4, shadcn/ui, next-intl (srpski i engleski),
Supabase (PostgreSQL 17, RLS, Realtime), Vitest (testovi baze).
U narednim fazama: Supabase Auth u aplikaciji, Zod, Swagger/OpenAPI, Recharts, Playwright.

## Pokretanje

Potrebno: Node.js 22, pnpm i Docker (za lokalni Supabase).

```bash
pnpm install
pnpm db:start     # lokalni Supabase (prvi put preuzima Docker slike); ispisuje adrese i ključeve
pnpm dev          # razvojni server na http://localhost:3000
```

`pnpm db:start` primenjuje sve migracije iz `supabase/migrations/` i puni bazu iz `supabase/seed.sql`.
Supabase Studio (pregled baze u pregledaču): http://127.0.0.1:54323.

## Demo nalozi (samo lokalno, iz `supabase/seed.sql`)

Lozinka za sve naloge: `Lozinka123!`

| Email                  | Uloga         |
| ---------------------- | ------------- |
| `admin@helpdesk.test`  | Administrator |
| `agent@helpdesk.test`  | Agent         |
| `agent2@helpdesk.test` | Agent         |
| `ana@helpdesk.test`    | Korisnik      |
| `marko@helpdesk.test`  | Korisnik      |

## Komande

| Komanda                             | Šta radi                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | pokreće aplikaciju u razvojnom režimu                                                          |
| `pnpm build`                        | pravi produkcioni build                                                                        |
| `pnpm start`                        | pokreće produkcioni build                                                                      |
| `pnpm lint`                         | ESLint provera                                                                                 |
| `pnpm typecheck`                    | generiše tipove ruta i proverava TypeScript                                                    |
| `pnpm format` / `pnpm format:check` | formatira kod / proverava format (Prettier)                                                    |
| `pnpm db:start` / `pnpm db:stop`    | pokreće / zaustavlja lokalni Supabase                                                          |
| `pnpm db:reset`                     | briše lokalnu bazu i ponovo primenjuje migracije i seed                                        |
| `pnpm db:types`                     | generiše TypeScript tipove baze u `src/types/database.ts`                                      |
| `pnpm test:unit`                    | unit testovi (bez baze): withApi, greške, ApiClient, OpenAPI, real-time                        |
| `pnpm test:db`                      | integracioni testovi baze (RLS, RPC funkcije, prelazi statusa); traži pokrenut `pnpm db:start` |

## Promenljive okruženja

Kopirati `.env.example` u `.env.local` i popuniti vrednosti. Za lokalni Supabase: `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` su `API_URL` i `ANON_KEY` iz `pnpm exec supabase status -o env`.

API dokumentacija (Swagger UI): http://localhost:3000/api-docs.

## Stanje razvoja

| Faza | Sadržaj                                              | Stanje      |
| ---- | ---------------------------------------------------- | ----------- |
| 1    | Kostur aplikacije, prevodi, početna stranica, CI     | završeno    |
| 2    | Baza podataka (Supabase)                             | završeno    |
| 3    | Infrastruktura API-ja, greške, Swagger (`/api-docs`) | u pregledu  |
| 4–10 | vidi `docs/07-uputstvo-za-implementaciju.md`         | nije počelo |
