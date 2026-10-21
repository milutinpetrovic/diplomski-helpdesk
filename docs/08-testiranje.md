# 08 — Testiranje

Izveštaj za poglavlje rada „Testiranje aplikacije“. Opisuje koje vrste testova postoje, šta svaka dokazuje, kako se pokreću i koliko koda pokrivaju. Plan je u `07-uputstvo-za-implementaciju.md` (Faza 9).

## 1. Vrste testova

| Vrsta        | Alat                                  | Lokacija                 | Broj testova | Šta dokazuje                                                                                                               |
| ------------ | ------------------------------------- | ------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Unit         | Vitest                                | `tests/unit/`            | 302          | Pravila bez baze: tabela prelaza statusa, ko sme šta (`TicketAccessPolicy`), Zod šeme, mapiranje grešaka, pomoćne funkcije |
| Integracioni | Vitest + lokalni Supabase             | `tests/integration/`     | 190          | API rute i RPC funkcije nad pravom bazom, prijavljeni kao različite uloge; real-time događaji                              |
| RLS          | Vitest + lokalni Supabase (PostgREST) | `tests/integration/rls/` | 63           | Svaka ćelija RLS matrice (sekcija 3): baza sama brani podatke i kad se API zaobiđe                                         |
| E2E          | Playwright                            | `tests/e2e/`             | 15           | Glavni scenariji u pravom pregledaču (Chromium), kao korisnik, agent i admin (sekcija 5)                                   |
| API          | Postman + newman                      | `postman/`               | 57 poziva    | Svaka API ruta iz Swagger-a pozvana kao prava uloga: status, oblik odgovora (šema iz OpenAPI-ja) i kod greške (sekcija 6)  |

Broj integracionih testova ne uključuje RLS testove (oni su u svom redu). Svi testovi se pokreću u CI-u (GitHub Actions, `.github/workflows/ci.yml`) na svaki push i pull request.

## 2. Pokretanje

| Komanda                 | Šta radi                                                                                    | Potrebno                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `pnpm test:unit`        | unit testovi (nekoliko sekundi)                                                             | ništa                                           |
| `pnpm test:db`          | integracioni i RLS testovi                                                                  | `pnpm db:start`                                 |
| `pnpm test:coverage`    | svi Vitest testovi + izveštaj o pokrivenosti u `coverage/` (otvoriti `coverage/index.html`) | `pnpm db:start`                                 |
| `pnpm test:e2e`         | E2E testovi u pregledaču; aplikaciju sam pokreće (`pnpm start`) na http://localhost:3000    | `pnpm db:start`, `pnpm seed:demo`, `pnpm build` |
| `pnpm test:api`         | Postman kolekcija preko newman-a nad http://localhost:3000                                  | `pnpm db:start`, aplikacija pokrenuta           |
| `pnpm postman:generate` | ponovo pravi kolekciju iz `/api/openapi` (posle izmene ili nove rute)                       | aplikacija pokrenuta                            |

U CI-u:

- posao `check` pokreće unit testove
- posao `db` pokreće `pnpm test:coverage` nad lokalnim Supabase-om i čuva izveštaj kao artefakt **coverage** (preuzima se sa stranice CI pokretanja)
- posao `e2e` pokreće Supabase, demo podatke, build i `pnpm test:e2e`; izveštaj Playwright-a (sa snimcima ekrana i tragom za test koji padne) čuva se kao artefakt **playwright-report**
- posao `api` pokreće Supabase, demo podatke i aplikaciju, proverava da je Postman kolekcija usklađena sa OpenAPI-jem (`pnpm postman:generate --check`) i dva puta pokreće `pnpm test:api` (kolekcija mora moći da se ponovi nad istom bazom)

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
| `responsive.spec.ts`       | sve stranice svake uloge na 390, 768 i 1280 px bez vodoravnog pomeranja stranice                                                                                           | NFZ-1                                          |
| `keyboard.spec.ts`         | samo tastatura: link „Preskoči na sadržaj“, meni na telefonu (Enter/Escape, fokus se vraća), dijalog za potvrdu (Escape, fokus se vraća)                                   | NFZ-4                                          |

Registracija i real-time traže pravi Supabase Auth (sa Mailpit-om) i Realtime, koje pokreće `supabase start`. U okruženju bez Docker-a real-time test se preskače (`REALTIME_TESTS=off`), kao i integracioni real-time testovi. U CI-u rade svi.

## 6. Postman kolekcija (API)

Kolekcija `postman/helpdesk.postman_collection.json` poziva API isto kao spoljni klijent (Postman, mobilna aplikacija): samo preko HTTP-a i tokena `Authorization: Bearer`, bez kolačića. Uputstvo za uvoz i pokretanje u Postman aplikaciji je u `postman/README.md`.

**Kako nastaje.** Kolekciju pravi skripta `scripts/postman-generate.mts` iz OpenAPI specifikacije (`GET /api/openapi`), iste one koju prikazuje Swagger na `/api-docs`. Skripta ima spisak poziva (scenario), a iz specifikacije uzima opis rute i JSON šemu odgovora. Ako neka ruta iz Swagger-a nema Postman poziv, skripta javlja grešku. Zato nova ruta ne može da se doda bez Postman testa, a Swagger i Postman uvek opisuju isti API. U CI-u `--check` proverava da sačuvana kolekcija odgovara specifikaciji.

**Šta proverava svaki poziv:**

- status odgovora (npr. 201 za novi zahtev, 403 za zabranjenu radnju)
- za uspešan odgovor: da JSON odgovara šemi iz OpenAPI-ja (`pm.response.to.have.jsonSchema`)
- za grešku: jedinstven oblik `{ error: { code, message } }` i tačan kod greške
- dodatne provere gde je bitno (npr. korisnik ne vidi interne beleške, panel je za pravu ulogu)

**Redosled (folderi):**

| Folder             | Šta radi                                                                                                                                                       | Primeri grešaka                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Prijava (Auth)  | prijava kao korisnik, agent i admin (tokeni se čuvaju u promenljivama kolekcije); registracija; zaboravljena lozinka; Google prijava i callback (preusmerenje) | pogrešna lozinka `INVALID_CREDENTIALS`, neispravan email i kratka lozinka `VALIDATION_ERROR`, bez prijave `UNAUTHENTICATED`                                                                         |
| 2. Profil          | čitanje i izmena profila                                                                                                                                       | bez prijave `UNAUTHENTICATED`                                                                                                                                                                       |
| 3. Zahtevi         | ceo život zahteva: korisnik prijavi i izmeni → agent preuzme, odgovori, napiše internu belešku, reši → korisnik oceni; komentari i istorija                    | agent ne prijavljuje `FORBIDDEN`, nepostojeći `TICKET_NOT_FOUND`, interna beleška korisnika `FORBIDDEN_INTERNAL_COMMENT`, zabranjen prelaz `INVALID_STATUS_TRANSITION`, druga ocena `ALREADY_RATED` |
| 4. Obaveštenja     | lista, jedno pročitano, sva pročitana                                                                                                                          | —                                                                                                                                                                                                   |
| 5. Kontrolni panel | isti poziv za tri uloge daje tri različita panela                                                                                                              | —                                                                                                                                                                                                   |
| 6. Analitika       | pregled, po kategoriji, po agentu, trend                                                                                                                       | agent `FORBIDDEN`, obrnut period `VALIDATION_ERROR`                                                                                                                                                 |
| 7. Administracija  | pretraga i izmena naloga; nova kategorija i njena deaktivacija                                                                                                 | korisnik `FORBIDDEN`, izmena sopstvenog naloga `CANNOT_MODIFY_SELF`, ista oznaka `CATEGORY_SLUG_TAKEN`                                                                                              |
| 8. Sistem i odjava | OpenAPI specifikacija; odjava sa posebnom prijavom (da ne poništi tokene ostalih poziva)                                                                       | —                                                                                                                                                                                                   |

Ukupno 57 poziva za svih 34 API operacija (30 putanja). Kolekcija pravi nov zahtev, novog korisnika i novu (pa deaktiviranu) kategoriju pri svakom pokretanju, zato se ne pokreće nad produkcijom. Okruženja: `postman/local.postman_environment.json` (http://localhost:3000) i `postman/demo.postman_environment.json` (adresa demo servera, upisuje se posle deploy-a).

## 7. Responzivnost i pristupačnost (Faza 10)

**Širine ekrana.** Svaka stranica je proverena kao gost, korisnik, agent i admin na tri širine:

- 390 px: telefon, meni iza dugmeta
- 768 px: tablet, bočni meni je vidljiv
- 1280 px: računar

Ukupno je to 63 kombinacije stranice, širine i uloge. Za svaku je napravljen snimak ekrana, i za svaku je mereno da li je stranica šira od ekrana.

Pronađena greška: lista naloga (`/admin/users`) na tabletu je bila za 105 px šira od ekrana. Kolone reda (ime, uloga, broj zahteva, dugme) počinjale su već od širine `md`, a pored bočnog menija za njih nema mesta. Sada se ređaju u jedan red tek od širine `lg`. Test `responsive.spec.ts` sada proverava sve stranice na sve tri širine, pa bi isti problem odmah pao u CI-u. Tabele sa mnogo kolona (lista zahteva) i kanban tabla se pomeraju unutar svog okvira, a ne cela stranica.

**Lighthouse (kategorija Accessibility).** Mereno je na svakoj stranici, za svaku ulogu, u režimu telefona i računara: ukupno 38 merenja (Lighthouse 13, Chromium).

| Stranica                                    | Pre ispravki | Posle |
| ------------------------------------------- | ------------ | ----- |
| prijava, registracija, zaboravljena lozinka | 100          | 100   |
| kontrolni panel (sve uloge)                 | 100          | 100   |
| lista, kanban, novi zahtev, zahtev          | 100          | 100   |
| obaveštenja, profil, korisnici              | 100          | 100   |
| analitika                                   | 96 / 97      | 100   |
| kategorije                                  | 96           | 100   |

Ispravljeno:

- **Analitika:** grafikoni su sakriveni od čitača ekrana (`aria-hidden`), jer su isti podaci u tabeli ispod. Recharts je ipak davao grafikonu fokus tastaturom, pa je fokus padao na nevidljiv element. Sada je `accessibilityLayer={false}`.
- **Kategorije:** oznaka „Neaktivna“ je imala premali kontrast teksta. Sada koristi osnovnu boju teksta.
- **Dugmad za jezik:** vidljivo „SR“/„EN“ sada je deo naziva dugmeta („SR (Srpski)“), da korisnik koji upravlja glasom može da ga izgovori (WCAG 2.5.3).
- **Dijalozi:** posle zatvaranja prozora za potvrdu (Escape ili „Otkaži“) fokus se vraća na dugme koje ga je otvorilo. Ranije je padao na početak stranice. Ovo je pronašao test `keyboard.spec.ts`.

Lighthouse i dalje navodi informativnu stavku „label-content-name-mismatch“, koja ne ulazi u ocenu, za dve vrste elemenata:

- **Zvonce za obaveštenja:** vidljiv je samo broj („9+“), a naziv je „Obaveštenja (12 nepročitanih)“.
- **Kartice i brojevi na panelu:** naziv namerno daje celu rečenicu za čitač ekrana, npr. „Nedodeljeni: 6. Prikaži zahteve: Nedodeljeni“.

Oba su svesno ostavljena, jer je pun naziv korisniji za čitač ekrana od samog broja.

Lighthouse se pokreće ručno (`npx lighthouse <adresa> --only-categories=accessibility`), nad stranicom na koju je pregledač već prijavljen. Zato nije deo CI-a.
