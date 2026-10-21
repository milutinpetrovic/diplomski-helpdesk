# 08 — Testiranje

Izveštaj za poglavlje rada „Testiranje aplikacije“. Opisuje koje vrste testova postoje, šta svaka dokazuje, kako se pokreću i koliko koda pokrivaju. Plan je u `07-uputstvo-za-implementaciju.md` (Faza 9).

## 1. Vrste testova

| Vrsta        | Alat                                  | Lokacija                 | Broj testova | Šta dokazuje                                                                                                               |
| ------------ | ------------------------------------- | ------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Unit         | Vitest                                | `tests/unit/`            | 294          | Pravila bez baze: tabela prelaza statusa, ko sme šta (`TicketAccessPolicy`), Zod šeme, mapiranje grešaka, pomoćne funkcije |
| Integracioni | Vitest + lokalni Supabase             | `tests/integration/`     | 190          | API rute i RPC funkcije nad pravom bazom, prijavljeni kao različite uloge; real-time događaji                              |
| RLS          | Vitest + lokalni Supabase (PostgREST) | `tests/integration/rls/` | 63           | Svaka ćelija RLS matrice (sekcija 3): baza sama brani podatke i kad se API zaobiđe                                         |
| E2E          | Playwright                            | `tests/e2e/`             | 11           | Glavni scenariji u pravom pregledaču (Chromium), kao korisnik, agent i admin (sekcija 5)                                   |
| API          | Postman + newman                      | `postman/`               | —            | Faza 9c                                                                                                                    |

Broj integracionih testova ne uključuje RLS testove (oni su u svom redu). Svi testovi se pokreću u CI-u (GitHub Actions, `.github/workflows/ci.yml`) na svaki push i pull request.

## 2. Pokretanje

| Komanda              | Šta radi                                                                                    | Potrebno                                        |
| -------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `pnpm test:unit`     | unit testovi (nekoliko sekundi)                                                             | ništa                                           |
| `pnpm test:db`       | integracioni i RLS testovi                                                                  | `pnpm db:start`                                 |
| `pnpm test:coverage` | svi Vitest testovi + izveštaj o pokrivenosti u `coverage/` (otvoriti `coverage/index.html`) | `pnpm db:start`                                 |
| `pnpm test:e2e`      | E2E testovi u pregledaču; aplikaciju sam pokreće (`pnpm start`) na http://localhost:3000    | `pnpm db:start`, `pnpm seed:demo`, `pnpm build` |

U CI-u:

- posao `check` pokreće unit testove
- posao `db` pokreće `pnpm test:coverage` nad lokalnim Supabase-om i čuva izveštaj kao artefakt **coverage** (preuzima se sa stranice CI pokretanja)
- posao `e2e` pokreće Supabase, demo podatke, build i `pnpm test:e2e`; izveštaj Playwright-a (sa snimcima ekrana i tragom za test koji padne) čuva se kao artefakt **playwright-report**

## 3. RLS matrica i testovi

Matrica je iz `02-baza-podataka.md`, sekcija 8. Testovi pričaju direktno sa bazom (PostgREST), kao prijavljeni korisnik, a ne preko API-ja. Tako dokazuju da podaci ostaju zaštićeni i kad bi neko zaobišao aplikaciju, na primer pozvao Supabase javnim ključem iz pregledača.

Baza odbija na dva načina:

- **greška 42501**: uloga nema pravo nad tabelom ili kolonom (GRANT), ili novi red ne prolazi politiku
- **prazan rezultat**: politika filtrira redove, pa upit ne vidi, ne menja i ne briše nijedan red

Ispod je svaka ćelija matrice i test koji je pokriva. Naziv testa počinje oznakom ćelije, isto kao u izlazu Vitest-a.

### `profiles` — `rls/profiles.test.ts`

| Ćelija | Pravilo                                                     | Test                                                                                                                                                   |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SELECT | svoj red; staff vidi sve; gost ništa                        | `SELECT · gost: nema pristup`, `SELECT · korisnik: vidi samo svoj red`, `SELECT · agent i admin: vide sve profile`                                     |
| INSERT | samo triger                                                 | `INSERT · svi: direktan upis nije dozvoljen`, `INSERT · triger: nov nalog dobija profil sa ulogom customer`                                            |
| UPDATE | svoj red, samo ime/avatar/jezik; uloga i aktivnost samo RPC | `UPDATE · korisnik: menja svoje ime, avatar i jezik`, `UPDATE · svi: tuđ profil se ne menja`, `UPDATE · svi: uloga i aktivnost se ne menjaju direktno` |
| DELETE | niko                                                        | `DELETE · svi: brisanje profila nije dozvoljeno`                                                                                                       |

### `categories` — `rls/categories.test.ts`

| Ćelija | Pravilo                             | Test                                                                                                                            |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| SELECT | prijavljeni vide aktivne; admin sve | `SELECT · gost: nema pristup`, `SELECT · korisnik i agent: vide aktivne, ne vide neaktivne`, `SELECT · admin: vidi i neaktivne` |
| INSERT | admin                               | `INSERT · korisnik i agent: odbijeno`, `INSERT · admin: dozvoljeno`                                                             |
| UPDATE | admin                               | `UPDATE · korisnik i agent: ne menjaju nijedan red`, `UPDATE · admin: menja i aktivira kategoriju`                              |
| DELETE | niko (deaktivacija)                 | `DELETE · svi (i admin): brisanje nije dozvoljeno`                                                                              |

### `tickets` — `rls/tickets.test.ts`

| Ćelija | Pravilo                                                        | Test                                                                                                                                                                                          |
| ------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SELECT | vlasnik svoje; staff sve                                       | `SELECT · gost: nema pristup`, `SELECT · korisnik: vidi samo svoje zahteve`, `SELECT · drugi korisnik: ne vidi tuđ zahtev ni po ID-ju`, `SELECT · agent i admin: vide zahteve svih korisnika` |
| INSERT | RPC `create_ticket` (samo customer)                            | `INSERT · svi: direktan upis nije dozvoljen`, `INSERT · RPC create_ticket: korisnik sme, agent i admin ne smeju`                                                                              |
| UPDATE | RPC (`update_ticket`, `assign_ticket`, `change_ticket_status`) | `UPDATE · svi: direktna izmena nije dozvoljena`, `UPDATE · RPC: drugi korisnik ne menja tuđ zahtev`                                                                                           |
| DELETE | niko                                                           | `DELETE · svi: brisanje nije dozvoljeno`                                                                                                                                                      |

Pravila samih RPC funkcija (svaki prelaz statusa po ulozi, dodela, izmena) testiraju `status-transitions.test.ts`, `tickets-comments.test.ts` i `assign-rate-notifications.test.ts`.

### `ticket_comments` — `rls/ticket-comments.test.ts`

| Ćelija | Pravilo                                          | Test                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SELECT | vlasnik: javni komentari svog zahteva; staff sve | `SELECT · gost: nema pristup`, `SELECT · vlasnik zahteva: vidi javne komentare, ne vidi interne beleške`, `SELECT · drugi korisnik: ne vidi komentare tuđeg zahteva`, `SELECT · agent i admin: vide javne i interne komentare` |
| INSERT | RPC `add_comment` (korisnik samo javne)          | `INSERT · svi: direktan upis nije dozvoljen`, `INSERT · RPC add_comment: korisnik ne može da napiše internu belešku`, `INSERT · RPC add_comment: drugi korisnik ne komentariše tuđ zahtev`                                     |
| UPDATE | niko                                             | `UPDATE · svi: izmena komentara nije dozvoljena`                                                                                                                                                                               |
| DELETE | niko                                             | `DELETE · svi: brisanje komentara nije dozvoljeno`                                                                                                                                                                             |

### `ticket_history` — `rls/ticket-history.test.ts`

| Ćelija | Pravilo                              | Test                                                                                                                                                                                                                                     |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SELECT | ko vidi zahtev; bez teksta komentara | `SELECT · gost: nema pristup`, `SELECT · vlasnik zahteva: vidi istoriju svog zahteva`, `SELECT · drugi korisnik: ne vidi istoriju tuđeg zahteva`, `SELECT · agent i admin: vide istoriju`, `SELECT · istorija ne sadrži tekst komentara` |
| INSERT | RPC                                  | `INSERT · svi: direktan upis nije dozvoljen`                                                                                                                                                                                             |
| UPDATE | niko                                 | `UPDATE · svi: istorija se ne menja`                                                                                                                                                                                                     |
| DELETE | niko                                 | `DELETE · svi: istorija se ne briše`                                                                                                                                                                                                     |

### `ticket_ratings` — `rls/ticket-ratings.test.ts`

| Ćelija | Pravilo                                   | Test                                                                                                                                                                     |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SELECT | ko vidi zahtev                            | `SELECT · gost: nema pristup`, `SELECT · vlasnik: vidi ocenu svog zahteva`, `SELECT · drugi korisnik: ne vidi ocene tuđih zahteva`, `SELECT · agent i admin: vide ocene` |
| INSERT | RPC `rate_ticket` (vlasnik, rešen zahtev) | `INSERT · svi: direktan upis nije dozvoljen`, `INSERT · RPC rate_ticket: samo vlasnik, samo rešen zahtev`                                                                |
| UPDATE | niko                                      | `UPDATE · svi: ocena se ne menja`                                                                                                                                        |
| DELETE | niko                                      | `DELETE · svi: ocena se ne briše`                                                                                                                                        |

### `notifications` — `rls/notifications.test.ts`

| Ćelija | Pravilo                  | Test                                                                                                                                                           |
| ------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SELECT | samo primalac            | `SELECT · gost: nema pristup`, `SELECT · svaka uloga: vidi samo obaveštenja kojima je primalac`, `SELECT · tuđe obaveštenje se ne vidi ni po ID-ju (ni admin)` |
| INSERT | RPC                      | `INSERT · svi: direktan upis nije dozvoljen`                                                                                                                   |
| UPDATE | primalac, samo `is_read` | `UPDATE · primalac: označava svoje obaveštenje kao pročitano`, `UPDATE · tuđe obaveštenje se ne menja`, `UPDATE · primalac: ostale kolone se ne menjaju`       |
| DELETE | primalac                 | `DELETE · primalac: briše svoje obaveštenje`, `DELETE · tuđe obaveštenje se ne briše`                                                                          |

### `attachments`

Tabela ne postoji: prilozi su prebačeni u moguća proširenja (CLAUDE.md, sekcija 8, Faza A), pa ovaj red matrice nema testove.

### Neaktivan nalog — `rls/inactive-account.test.ts`

Napomena ispod matrice: neaktivan nalog ne vidi ništa, a RPC funkcije mu vraćaju `ACCOUNT_DISABLED`.

| Pravilo                                | Test                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| ne vidi nijedan red, ni svoje podatke  | `SELECT · ne vidi nijedan red ni u jednoj tabeli (ni svoje)` |
| ne menja ni svoj profil ni obaveštenja | `UPDATE i DELETE · ne menja ni svoj profil ni obaveštenja`   |
| RPC funkcije ga odbijaju               | `RPC · svaka akcija vraća ACCOUNT_DISABLED`                  |

### Da li testovi stvarno hvataju grešku

Test koji uvek prolazi ne dokazuje ništa. Zato je jedna provera urađena namerno: u lokalnoj bazi je privremeno dato pravo `DELETE` nad `ticket_ratings` (`grant delete on public.ticket_ratings to authenticated`). Test `DELETE · svi: ocena se ne briše` je tada pao, a posle vraćanja prava (`revoke`) ponovo je prošao.

## 4. Pokrivenost koda

Meri se koliki deo koda testovi zaista izvrše (alat `@vitest/coverage-v8`, zvanični dodatak za Vitest). Meri se:

- poslovna logika: `src/services/`, uključujući pravila u `src/services/policies/`
- API rute: `src/app/api/`
- pomoćne biblioteke: `src/lib/`

Stranice i React komponente se ne mere ovde, jer njih pokrivaju E2E testovi.

| Deo koda                                                                                      | Pokrivenost linija |
| --------------------------------------------------------------------------------------------- | ------------------ |
| `services/policies` (pravila)                                                                 | 100%               |
| `services/tickets`                                                                            | 100%               |
| `services/comments`, `ratings`, `notifications`, `dashboard`, `analytics`, `admin`, `profile` | 100%               |
| `services/categories`                                                                         | 96%                |
| `app/api` (API rute)                                                                          | 96%                |
| ukupno (services + lib + api)                                                                 | 93%                |

Brojevi su iz lokalnog pokretanja. Tačni brojevi za rad uzimaju se iz artefakta **coverage** poslednjeg CI pokretanja na `main`, gde rade i testovi registracije i potvrde emaila (`services/auth`), koji lokalno bez pravog Supabase Auth servera ne rade.

## 5. E2E scenariji (Playwright)

Testovi rade u pravom pregledaču (Chromium) nad pravom aplikacijom i lokalnim Supabase-om. Prijavljuju se kroz formu, kao pravi korisnici. Svaki test pravi svoj zahtev sa jedinstvenim naslovom, pa ne zavisi od demo podataka ni od drugih testova. Kad više korisnika radi istovremeno (korisnik i agent), svaki ima svoj kontekst pregledača, odnosno odvojene kolačiće i sesiju.

| Fajl                       | Scenario                                                                                                                                                                   | Slučajevi korišćenja / zahtevi                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `auth.spec.ts`             | registracija, potvrda emaila linkom iz Mailpit-a, prvi ulazak (uloga korisnik); pogrešna lozinka; odjava i zaštita stranica                                                | UC-01..UC-04, FZ-1                             |
| `ticket-lifecycle.spec.ts` | korisnik prijavi zahtev → agent preuzme, odgovori, napiše internu belešku, reši → korisnik vidi odgovor (ne i belešku), oceni i potvrdi; zatvoren zahtev se ne komentariše | UC-09, UC-11..UC-14, UC-16, UC-17, FZ-8, FZ-16 |
| `realtime.spec.ts`         | dva prozora: agent menja status, a korisniku se bez reload-a menjaju status i brojač na zvoncu                                                                             | FZ-12, FZ-13                                   |
| `rbac.spec.ts`             | korisnik ne ulazi u administraciju i analitiku; agent ne vidi administraciju i ne prijavljuje zahteve; admin otvara oba                                                    | FZ-3, NFZ-2                                    |
| `language.spec.ts`         | srpski → engleski, izbor se pamti posle reload-a                                                                                                                           | NFZ-7                                          |
| `mobile.spec.ts`           | telefon 390 px: meni iza dugmeta, lista, zahtev i kanban tabla bez vodoravnog pomeranja                                                                                    | NFZ-1                                          |
| `kanban.spec.ts`           | prevlačenje mišem (preuzimanje), zabranjen prelaz sa porukom, prevlačenje tastaturom                                                                                       | UC-13, UC-16, NFZ-4                            |

Registracija i real-time traže pravi Supabase Auth (sa Mailpit-om) i Realtime, koje pokreće `supabase start`. U okruženju bez Docker-a real-time test se preskače (`REALTIME_TESTS=off`), kao i integracioni real-time testovi. U CI-u rade svi.
