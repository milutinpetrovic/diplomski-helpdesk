# 07 — Uputstvo za implementaciju

Korak-po-korak plan programiranja. Svaka faza ima zadatke, fajlove i **kriterijume završetka**. Faza se ne smatra gotovom dok svi kriterijumi nisu ispunjeni. Pre svake faze pročitati `CLAUDE.md` i relevantne dokumente iz `docs/`.

## 0. Šta je potrebno pre početka

| Stavka                    | Detalj                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Node.js                   | 22 LTS                                                                                            |
| Paket menadžer            | `pnpm` (preporuka; brži i stroži) ili `npm` — izabrati jednom i ne mešati                         |
| Supabase CLI + Docker     | za lokalnu bazu (`supabase start`), migracije i testove RLS-a                                     |
| Supabase projekat (cloud) | za deploy; Auth: uključen email confirm, Google provider, automatsko povezivanje naloga po emailu |
| Google Cloud              | OAuth Client ID (Web); redirect URI = `https://<projekat>.supabase.co/auth/v1/callback`           |
| GitHub repozitorijum      | otvoreno pitanje: javni ili privatni                                                              |

### Verzije

Pri postavljanju projekta uzeti **poslednje stabilne verzije** i fiksirati ih u `package.json` (bez `^` za glavne pakete: `next`, `react`, `@supabase/*`, `zod`). Proveriti kompatibilnost:

- `next` (16.x) — koristi `proxy.ts` umesto `middleware.ts`; ako se iz nekog razloga uzme 15.x, fajl se zove `middleware.ts`.
- `zod` i `@asteasolutions/zod-to-openapi` — glavne verzije moraju da se slažu (proveriti README paketa).
- `tailwindcss` 4.x + `shadcn` CLI koji ga podržava.
- `next-intl` verzija koja podržava izabranu verziju Next.js-a.

Ostali paketi: `@supabase/supabase-js`, `@supabase/ssr`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `swagger-ui-react`, `date-fns`, `lucide-react` (ikone, dolazi sa shadcn), `sonner` (toast); dev: `typescript`, `eslint`, `prettier`, `vitest`, `@testing-library/react`, `@playwright/test`, `supabase` (CLI).

### Promenljive okruženja (`.env.example`)

| Promenljiva                                                    | Gde se koristi                      | Tajna?                  |
| -------------------------------------------------------------- | ----------------------------------- | ----------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                                     | klijent i server                    | ne                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ili novi „publishable“ ključ) | klijent i server                    | ne                      |
| `SUPABASE_SERVICE_ROLE_KEY`                                    | **samo** `scripts/seed-demo.ts`     | **da** — nikad u `src/` |
| `NEXT_PUBLIC_SITE_URL`                                         | redirect URL-ovi (OAuth, email)     | ne                      |
| `NEXT_PUBLIC_REALTIME_PROVIDER`                                | `supabase` \| `websocket`           | ne                      |
| `NEXT_PUBLIC_REALTIME_WS_URL`                                  | samo ako je `websocket`             | ne                      |
| `SWAGGER_ENABLED`                                              | `true`/`false` — prikaz `/api-docs` | ne                      |

## Faza 1 — Postavljanje projekta

Zadaci:

1. `create-next-app` sa TypeScript, ESLint, Tailwind, App Router, `src/` folderom, alias `@/*`.
2. `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`.
3. Prettier + ESLint pravila; skripte `lint`, `typecheck`, `test`, `test:e2e`, `db:types` (`supabase gen types typescript --local > src/types/database.ts`).
4. `shadcn init`; dodati osnovne komponente: button, input, textarea, select, label, form, card, badge, table, dialog, dropdown-menu, sheet (mobilni meni), tabs, avatar, skeleton, sonner.
5. `next-intl`: `messages/en.json`, `messages/sr.json`, `src/lib/i18n/` (config + `getRequestConfig` koji čita kolačić `NEXT_LOCALE`, podrazumevano `sr`). **Bez prefiksa jezika u URL-u** (aplikacija iza prijave; jezik u kolačiću).
6. `supabase init`, `supabase start`; `.env.local` sa lokalnim ključevima.
7. Struktura foldera iz CLAUDE.md, sekcija 5 (prazni folderi sa `README` ili prvim fajlom).
8. `README.md`: pokretanje, env promenljive, komande.
9. GitHub Actions (preporuka): na svaki push `lint`, `typecheck`, `test`, `build`.

Kriterijumi završetka:

- `pnpm dev` radi; početna stranica prikazuje tekst iz `messages/sr.json`, a dugme EN/SR menja jezik.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` prolaze bez grešaka.
- Svaki napravljen fajl ima blok-komentar na vrhu (srpski).

## Faza 2 — Baza podataka

Migracije (jedna tema po fajlu, `supabase migration new <naziv>`):

| Redosled | Migracija                | Sadržaj                                                                                               |
| -------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1        | `enums`                  | `user_role`, `ticket_status`, `ticket_priority`, `history_action`, `notification_type`                |
| 2        | `profiles`               | tabela, triger `handle_new_user`, `set_updated_at`, `prevent_role_self_change`                        |
| 3        | `helpers`                | `current_user_role()`, `is_staff()` (`security definer`, `set search_path = public`)                  |
| 4        | `categories`             | tabela + RLS                                                                                          |
| 5        | `tickets`                | tabela, indeksi, GIN za pretragu + RLS                                                                |
| 6        | `comments_history`       | `ticket_comments`, `ticket_history` + RLS                                                             |
| 7        | `ratings_notifications`  | `ticket_ratings`, `notifications` + RLS + dodavanje `notifications` u publikaciju `supabase_realtime` |
| 8        | `rpc_tickets`            | RPC funkcije iz tabele ispod                                                                          |
| 9        | `rpc_analytics`          | `analytics_*`, `agent_dashboard_stats`                                                                |
| 10       | `realtime_authorization` | politike na `realtime.messages` za privatne kanale `ticket:<id>` i `staff`                            |

RPC funkcije (sve `security invoker` osim gde je navedeno, sve u jednoj transakciji, sve proveravaju ulogu i pristup same — ne veruju klijentu):

| Funkcija               | Parametri                                           | Radi                                                                                                                                           |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_ticket`        | `p_title, p_description, p_category_id, p_priority` | INSERT ticket + history `created` + notifications svim aktivnim staff korisnicima. Vraća ticket.                                               |
| `add_comment`          | `p_ticket_id, p_body, p_is_internal`                | Provere (pristup, closed, internal samo staff); INSERT komentar; `first_response_at`; auto `waiting_on_customer → in_progress`; notifications. |
| `assign_ticket`        | `p_ticket_id, p_assignee_id`                        | Provere; UPDATE `assigned_to`; `open → in_progress`; history; notifications.                                                                   |
| `change_ticket_status` | `p_ticket_id, p_new_status`                         | Provera prelaza po istoj tabeli kao `StatusTransitionPolicy`; UPDATE status i vremena; history; notification.                                  |
| `rate_ticket`          | `p_ticket_id, p_score, p_comment`                   | Provere; INSERT rating; history; notification agentu.                                                                                          |
| `admin_update_user`    | `p_user_id, p_role, p_is_active`                    | Samo admin, ne sebe; pri oduzimanju staff uloge oslobađa dodeljene otvorene zahteve (history `unassigned`).                                    |

Napomena: RPC funkcije koje upisuju obaveštenja za **druge** korisnike moraju biti `security definer` (jer RLS ne dozvoljava INSERT u tuđa obaveštenja), uz eksplicitnu proveru `auth.uid()` i uloge na početku funkcije i `set search_path = public`.

`supabase/seed.sql`: kategorije + jedan admin. `scripts/seed-demo.ts`: realni demo podaci (vidi `02-baza-podataka.md`, sekcija 9).

Kriterijumi završetka:

- `supabase db reset` prolazi i puni bazu.
- `pnpm db:types` generiše tipove bez grešaka.
- RLS testovi (Faza 9 se ovde **započinje**): korisnik A ne vidi zahtev korisnika B; korisnik ne vidi interne komentare; korisnik ne može da promeni svoju ulogu.
- Svaka tabela, politika, triger i funkcija ima SQL komentar (srpski) iznad sebe.

## Faza 3 — Infrastruktura (temelj za sve rute)

Fajlovi:

- `lib/supabase/server.ts`, `lib/supabase/browser.ts` (sa `createClientFromBearer`).
- `lib/errors/codes.ts` (mapa `ErrorCode → httpStatus`), `lib/errors/app-error.ts`, `lib/errors/handler.ts`.
- `lib/auth/auth-guard.ts`, `lib/auth/auth-context.ts`.
- `lib/api/with-api.ts`, `lib/api/client.ts`.
- `lib/openapi/registry.ts`, `app/api/openapi/route.ts`, `app/api-docs/page.tsx`.
- `lib/realtime/types.ts`, `events.ts`, `supabase-provider.ts`, `supabase-publisher.ts`, `index.ts` (`getRealtimeProvider`, `getRealtimePublisher`).
- `proxy.ts` (ili `middleware.ts`): osvežavanje sesije + preusmerenja.
- `messages/*.json`: sekcija `errors` sa svim kodovima.

Obrazac API rute (svaka ruta ovako izgleda):

```ts
/**
 * Fajl: src/app/api/tickets/[id]/status/route.ts
 * Svrha: API ruta za promenu statusa zahteva (UC-13, UC-17).
 * Poziva je: StatusSelect komponenta (preko ApiClient-a), Swagger, Postman.
 * Povezano sa: TicketService.changeStatus, StatusTransitionPolicy, RPC change_ticket_status.
 */
import { withApi } from "@/lib/api/with-api";
import { changeStatusSchema, ticketIdParamsSchema } from "@/lib/validation/tickets";
import { TicketService } from "@/services/tickets/ticket-service";

/**
 * POST /api/tickets/{id}/status
 * Menja status zahteva ako je prelaz dozvoljen za ulogu prijavljenog korisnika.
 * Ulaz: { status } u telu, id zahteva u putanji.
 * Vraća: ažuriran zahtev sa novim dozvoljenim akcijama.
 * Uloge: customer (samo svoj zahtev i ograničeni prelazi), agent (dodeljen), admin.
 */
export const POST = withApi(
  { roles: ["customer", "agent", "admin"], params: ticketIdParamsSchema, body: changeStatusSchema },
  async ({ ctx, params, body }) => {
    // Servis sadrži svu poslovnu logiku; ruta samo prosleđuje proverene podatke.
    const service = new TicketService(ctx);
    return service.changeStatus(params.id, body.status);
  },
);
```

Kriterijumi završetka:

- `/api-docs` prikazuje Swagger UI (za sada samo `GET /api/openapi`).
- Test: `withApi` vraća 401 bez sesije, 403 za pogrešnu ulogu, 400 sa listom polja za neispravan ulaz.
- Bearer token iz Supabase sesije radi u Swaggeru („Authorize“).

## Faza 4 — Autentifikacija i profil

Zadaci: `AuthService`, `ProfileService`, rute iz sekcije Auth i Profil (`06`), stranice `/login`, `/register`, `/forgot-password`, `/reset-password`, `/profile`; `AppShell` sa menijem po ulozi, `LanguageSwitcher`, odjava.

Kriterijumi završetka:

- Registracija → email → potvrda → `/dashboard` (lokalno: Inbucket/Mailpit iz `supabase start`).
- Google prijava radi; prijava Google-om na email koji već postoji koristi isti profil.
- Neprijavljen korisnik ne može na `/dashboard`; korisnik ne može na `/admin/*` (server provera).
- Sve rute registrovane u Swaggeru sa primerima.
- Promena jezika menja i poruke grešaka na formama.

## Faza 5 — Zahtevi, komentari, istorija, ocene

Zadaci: `StatusTransitionPolicy` + `TicketAccessPolicy` (prvo, sa unit testovima za **svaki** red tabele prelaza), `TicketService`, `CommentService`, `RatingService`, `CategoryService` (čitanje), rute iz `06` (Tickets, Comments, Ratings, `GET /api/categories`, `GET /api/agents`), stranice `/tickets`, `/tickets/new`, `/tickets/[id]`.

Kriterijumi završetka:

- Korisnik kreira zahtev, vidi ga u listi, komentariše, potvrđuje ili ponovo otvara, ocenjuje.
- Agent preuzima, menja statuse, piše interni komentar koji korisnik ne vidi ni u UI ni preko API-ja.
- UI nudi samo dozvoljene akcije (iz `permissions` u odgovoru).
- Filteri i pretraga rade i čuvaju se u URL-u.
- `first_response_at`, `resolved_at`, `closed_at` se ispravno popunjavaju (test).
- Sve rute u Swaggeru.

## Faza 6 — Dashboard

Zadaci: `DashboardService` + `GET /api/dashboard` + `agent_dashboard_stats`; tri prikaza (`DashboardCustomer`, `DashboardAgent`, `DashboardAdmin`).

Kriterijum: svaka uloga vidi svoj dashboard sa tačnim brojevima iz demo podataka.

## Faza 7 — Real-time obaveštenja

Zadaci: `NotificationService` + rute; `useNotifications`, `NotificationBell`, toast; `useTicketRealtime` na detaljima zahteva i listi; `publish` u servisima posle uspešnih RPC poziva; politike Realtime Authorization.

Kriterijumi završetka:

- Dva browsera (korisnik i agent): akcija u jednom se pojavljuje u drugom bez reload-a, u roku od ~1 s.
- Korisnik se ne može pretplatiti na kanal tuđeg zahteva (test).
- Payload događaja ne sadrži tekst komentara ni naslov (provera u kodu i u testu).
- Promenom `NEXT_PUBLIC_REALTIME_PROVIDER` se ne menja nijedna komponenta (pregled koda).

## Faza 8 — Analitika i administracija

Zadaci: `AnalyticsService` + rute; stranica `/analytics` (KPI kartice, trend, raspodela, tabela agenata, CSAT); `UserAdminService`, `CategoryService` (izmena) + stranice `/admin/users`, `/admin/categories`.

Kriterijumi završetka:

- Grafikoni sa demo podacima izgledaju realno i menjaju se sa periodom.
- Admin ne može sebi da oduzme ulogu; oduzimanje uloge agentu oslobađa njegove zahteve.
- Agent i korisnik dobijaju 403 na svim `/api/analytics/*` i `/api/admin/*` rutama (test).

## Faza 9 — Testiranje (radi se kroz sve faze, ovde se zaokružuje)

| Vrsta        | Alat                                 | Šta se testira                                                                                                                                                                      | Lokacija                                       |
| ------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Unit         | Vitest                               | `StatusTransitionPolicy` (svaki prelaz × uloga), `TicketAccessPolicy`, Zod šeme, mapiranje grešaka, pomoćne funkcije                                                                | `tests/unit/`                                  |
| Integracioni | Vitest + lokalni Supabase            | servisi i RPC funkcije nad pravom bazom, prijavljeni kao različite uloge                                                                                                            | `tests/integration/`                           |
| RLS          | Vitest (klijenti po ulozi) ili pgTAP | matrica iz `02-baza-podataka.md`, sekcija 8 — svaka ćelija bar jedan test                                                                                                           | `tests/integration/rls/` ili `supabase/tests/` |
| E2E          | Playwright                           | glavni scenariji: registracija, kreiranje zahteva, agent preuzima i rešava, korisnik ocenjuje; real-time sa dva konteksta browsera; promena jezika; mobilni prikaz (viewport 390px) | `tests/e2e/`                                   |
| API          | Postman                              | kolekcija uvezena iz `/api/openapi`, sa testovima statusa i oblika odgovora; okruženja `local` i `demo`                                                                             | `postman/`                                     |

Kriterijumi: svi testovi prolaze u CI; za rad se sačuva izveštaj (broj testova, pokrivenost servisa i politika).

## Faza 10 — Responzivnost, pristupačnost, deploy, materijal za rad

Zadaci:

- Provera svih stranica na 390px, 768px, 1280px; mobilni meni (sheet).
- Pristupačnost: labele, fokus, kontrast, navigacija tastaturom (Lighthouse ≥ 90 za Accessibility).
- Deploy na Vercel ili Netlify + Supabase cloud; Google OAuth redirect za produkcioni domen; `SWAGGER_ENABLED` po odluci.
- Pokrenuti `seed-demo` na demo okruženju; demo nalozi u README-u.
- `docs/`: ažurirati sve dijagrame po stvarnom kodu; izvesti PNG/SVG za rad (`mmdc`).
- Snimci ekrana za poglavlja _Demonstracija_ i _Uputstvo za korisnike_ (po ulozi, oba jezika).

## Pravila koja važe u svakoj fazi

- **Komentari na srpskom** po pravilu iz CLAUDE.md (vrh fajla, svaka funkcija, koraci, SQL).
- **Nijedan tekst u JSX-u** — sve kroz `useTranslations` / `getTranslations`; novi ključ odmah u **oba** fajla `messages/en.json` i `messages/sr.json`.
- **Nijedna nova ruta bez Swagger registracije**, Zod šeme i bar jednog testa.
- **Nijedna nova tabela bez RLS-a** i testa za politiku.
- **Server Actions se ne koriste**; Server Components smeju da čitaju preko servisa.
- **Commit poruke** na engleskom, oblik `feat(tickets): add status change endpoint`, `fix(auth): ...`, `test(rls): ...`, `docs(diagrams): ...`.
- **Grana po fazi/funkcionalnosti** (`feature/tickets-status`), merge u `main` tek kad CI prolazi.
- Posle svake faze ažurirati dijagrame u `docs/` ako se nešto promenilo, i CLAUDE.md ako se promenila odluka.

## Struktura prevoda (`messages/sr.json`, isti ključevi u `en.json`)

```json
{
  "common": { "save": "Sačuvaj", "cancel": "Otkaži", "loading": "Učitavanje..." },
  "nav": { "dashboard": "Kontrolna tabla", "tickets": "Zahtevi", "myTickets": "Moji zahtevi" },
  "auth": {
    "login": "Prijava",
    "register": "Registracija",
    "continueWithGoogle": "Nastavi sa Google nalogom"
  },
  "tickets": {
    "status": {
      "open": "Otvoren",
      "in_progress": "U obradi",
      "waiting_on_customer": "Čeka korisnika",
      "resolved": "Rešen",
      "closed": "Zatvoren"
    },
    "priority": { "low": "Nizak", "medium": "Srednji", "high": "Visok", "urgent": "Hitan" }
  },
  "notifications": {
    "status_changed": "{actor} je promenio status zahteva #{number} u „{status}“"
  },
  "errors": {
    "TICKET_NOT_FOUND": "Zahtev nije pronađen.",
    "INVALID_STATUS_TRANSITION": "Ova promena statusa nije dozvoljena."
  }
}
```

## Mapa: dokument → poglavlje rada

| Poglavlje rada           | Izvor                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| Zahtevi sistema          | CLAUDE.md sekcija 4                                                 |
| Slučajevi korišćenja     | `01-slucajevi-koriscenja.md`                                        |
| Arhitektura projekta     | `03-dijagram-klasa.md` (slojevi, klase), `05-dijagrami-sekvenci.md` |
| Model podataka           | `02-baza-podataka.md`                                               |
| Struktura projekta       | CLAUDE.md sekcija 5                                                 |
| API (i Swagger)          | `06-api-i-stranice.md` + snimak `/api-docs`                         |
| Obrada izuzetaka         | `03` (AppError, ErrorCode), `06` (tabela statusa), SD-01            |
| Testiranje               | Faza 9 + izveštaji                                                  |
| Demonstracija i uputstvo | snimci ekrana iz Faze 10                                            |
| Zaključak i dalji razvoj | CLAUDE.md sekcija 8                                                 |
