# Tehnička podrška — veb aplikacija (diplomski rad)

Veb aplikacija za prijavu, praćenje i rešavanje zahteva za tehničku podršku, napravljena u Next.js-u.
Diplomski rad: Milutin Petrović (3407), Fakultet informacionih tehnologija, Univerzitet Metropolitan Beograd.
Mentor: dr Nemanja Zdravković.

- Kontekst i pravila za razvoj: [`CLAUDE.md`](CLAUDE.md)
- Projektni dizajn (use case, baza, klase, dijagrami sekvenci, API, plan po fazama): [`docs/`](docs/README.md)

## Tehnologije

Next.js 16 (App Router), React 19, TypeScript 5.9 (strict), Tailwind CSS 4, shadcn/ui, next-intl (srpski i engleski),
Supabase (PostgreSQL 17, Auth, RLS, Realtime), Zod, react-hook-form, Swagger/OpenAPI, Vitest.
U narednim fazama: Recharts, Playwright.

## Pokretanje

Potrebno: Node.js 22, pnpm i Docker (za lokalni Supabase).

```bash
pnpm install
pnpm db:start     # lokalni Supabase (prvi put preuzima Docker slike); ispisuje adrese i ključeve
pnpm dev          # razvojni server na http://localhost:3000
```

Aplikaciju otvarati na **http://localhost:3000** (ne na 127.0.0.1), jer su za tu adresu podešeni linkovi iz emailova i Google prijava.

`pnpm db:start` primenjuje sve migracije iz `supabase/migrations/` i puni bazu iz `supabase/seed.sql`.
Supabase Studio (pregled baze u pregledaču): http://127.0.0.1:54323.
Emailovi (potvrda naloga, nova lozinka) se lokalno ne šalju stvarno, nego se vide u Mailpit-u: http://127.0.0.1:54324.

## Demo nalozi (samo lokalno, iz `supabase/seed.sql`)

Lozinka za sve naloge: `Lozinka123!`

| Email                  | Uloga         |
| ---------------------- | ------------- |
| `admin@helpdesk.test`  | Administrator |
| `agent@helpdesk.test`  | Agent         |
| `agent2@helpdesk.test` | Agent         |
| `ana@helpdesk.test`    | Korisnik      |
| `marko@helpdesk.test`  | Korisnik      |

Seed pravi i **12 demo zahteva** (#1001–#1012) u svim statusima, sa komentarima, internim beleškama agenata, istorijom i jednom ocenom: Ana i Marko imaju po šest zahteva, a rešavaju ih agenti Jelena i Nikola. Zahtev #1004 je rešen i Ana može da ga oceni. `pnpm db:reset` vraća bazu na ove početne podatke.

## Komande

| Komanda                             | Šta radi                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm dev`                          | pokreće aplikaciju u razvojnom režimu                                                   |
| `pnpm build`                        | pravi produkcioni build                                                                 |
| `pnpm start`                        | pokreće produkcioni build                                                               |
| `pnpm lint`                         | ESLint provera                                                                          |
| `pnpm typecheck`                    | generiše tipove ruta i proverava TypeScript                                             |
| `pnpm format` / `pnpm format:check` | formatira kod / proverava format (Prettier)                                             |
| `pnpm db:start` / `pnpm db:stop`    | pokreće / zaustavlja lokalni Supabase                                                   |
| `pnpm db:reset`                     | briše lokalnu bazu i ponovo primenjuje migracije i seed                                 |
| `pnpm db:types`                     | generiše TypeScript tipove baze u `src/types/database.ts`                               |
| `pnpm test:unit`                    | unit testovi (bez baze): withApi, greške, Zod šeme, pravila statusa i pristupa, OpenAPI |
| `pnpm test:db`                      | integracioni testovi (RLS, RPC, API zahteva, prijava i profil); traži `pnpm db:start`   |

## Promenljive okruženja

Kopirati `.env.example` u `.env.local` i popuniti vrednosti. Za lokalni Supabase: `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY` su `API_URL` i `ANON_KEY` iz `pnpm exec supabase status -o env`.

API dokumentacija (Swagger UI): http://localhost:3000/api-docs. Za pozive koji traže prijavu: pozvati `POST /api/auth/login` sa demo nalogom, kopirati `session.accessToken` iz odgovora i nalepiti ga u „Authorize“.

## Prijava i nalozi

- Registracija emailom: nalog se aktivira klikom na link iz emaila (lokalno u Mailpit-u). Svaki nov nalog dobija ulogu „korisnik“; ulogu menja samo administrator.
- Zaštita stranica: gost se sa zaštićenih stranica šalje na `/login`, a `/admin/*` i `/analytics` vidi samo administrator (provera na serveru).
- Šabloni emailova su u `supabase/templates/` (srpski i engleski).

### Google prijava (podešava se jednom)

Kod za Google prijavu je gotov; potrebni su samo ključevi. Ključevi se nikad ne upisuju u git.

1. **Supabase cloud projekat** (besplatan): na [supabase.com](https://supabase.com) napraviti projekat. U _Project Settings → API_ se nalaze URL i `anon` ključ (to su `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. **Google ključevi**: u [Google Cloud Console](https://console.cloud.google.com) → _APIs & Services → Credentials → Create credentials → OAuth client ID_, tip _Web application_.
   - _Authorized redirect URIs_: `https://<id-projekta>.supabase.co/auth/v1/callback` (tačna adresa piše u Supabase-u, _Authentication → Sign In / Providers → Google_).
   - Google daje _Client ID_ i _Client secret_.
3. **Supabase → Authentication → Sign In / Providers → Google**: uključiti, upisati _Client ID_ i _Client secret_.
4. **Supabase → Authentication → URL Configuration**: _Site URL_ = adresa aplikacije (npr. `http://localhost:3000` ili adresa na Vercel/Netlify-ju); u _Redirect URLs_ dodati `<adresa aplikacije>/**`.
5. **Supabase → Authentication → Email Templates**: u _Confirm signup_ i _Reset password_ nalepiti sadržaj fajlova `supabase/templates/confirmation.html` i `recovery.html`.
6. **Supabase → Authentication → Sign In / Providers → Email**: uključen _Confirm email_.

Povezivanje naloga: kada se korisnik koji je registrovan emailom prijavi Google nalogom sa istim (potvrđenim) emailom, Supabase ga vezuje za isti nalog, pa ostaju isti profil i uloga.

Za Google prijavu sa lokalnim Supabase-om: u `supabase/config.toml` postaviti `[auth.external.google] enabled = true`, a ključeve upisati u `supabase/.env` kao `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` i `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` (redirect URI u Google-u tada je `http://127.0.0.1:54321/auth/v1/callback`).

## Stanje razvoja

| Faza | Sadržaj                                              | Stanje      |
| ---- | ---------------------------------------------------- | ----------- |
| 1    | Kostur aplikacije, prevodi, početna stranica, CI     | završeno    |
| 2    | Baza podataka (Supabase)                             | završeno    |
| 3    | Infrastruktura API-ja, greške, Swagger (`/api-docs`) | završeno    |
| 4    | Prijava, registracija, Google nalog, profil, meni    | u pregledu  |
| 5–10 | vidi `docs/07-uputstvo-za-implementaciju.md`         | nije počelo |
