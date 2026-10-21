# CLAUDE.md — Diplomski rad: veb aplikacija za tehničku podršku (Next.js)

Ovaj fajl daje kontekst svakoj budućoj sesiji koja radi na kodu. Pročitaj ga ceo pre nego što počneš.

**Projektni dizajn je u folderu `docs/`** (use case, baza, klase, dijagrami sekvenci, API, uputstvo za implementaciju po fazama). Pre rada na bilo kojoj funkcionalnosti pročitaj `docs/README.md` i relevantne dokumente; nazivi tabela, klasa, metoda, ruta i kodova grešaka iz `docs/` su obavezujući. Redosled rada: `docs/07-uputstvo-za-implementaciju.md`.

## 1. O radu

- **Student:** Milutin Petrović, br. indeksa 3407
- **Fakultet:** Fakultet informacionih tehnologija, Univerzitet Metropolitan Beograd (OAS, studijski program Informacione tehnologije)
- **Predmet:** IT495 – Završni rad
- **Mentor:** dr Nemanja Zdravković, vanredni profesor
- **Komisija:** dr Miloš Kostić (predsednik), dr Mladen Opačić (treći član) — _proveriti: na str. 5 PDF-a u naslovu piše "Emilija Kisić, docent"_
- **Tema (zvanični naziv):** _Razvoj veb aplikacije za tehničku podršku koristeći Next.JS radni okvir_
- **Datum predloga teme:** 15.11.2024.

### Cilj (iz odobrenog apstrakta)

Veb aplikacija za korisničku/IT podršku koja unapređuje upravljanje zahtevima (tiketima) kroz intuitivan interfejs za **kreiranje, praćenje i rešavanje zahteva**. Rad treba da demonstrira napredne veštine veb razvoja.

### Šta je eksplicitno obećano u apstraktu (obavezno — ne izbacivati)

1. **Next.js** kao glavni radni okvir (React, SSR/SSG).
2. **Autentifikacija korisnika.**
3. **Kontrola pristupa zasnovana na ulogama (RBAC).**
4. **Kontrolni panel (dashboard)** za praćenje statusa zahteva.
5. **Obaveštenja u realnom vremenu** preko **WebSocket** integracije.
6. **Responzivan dizajn** (rad na različitim uređajima).
7. **Next.js API rute** za serversku logiku.
8. **Supabase** baza podataka.
9. **Analitika** performansi tima za podršku.

Ako neka odluka u kodu ugrožava bilo koju od ovih stavki, zastani i pitaj Milutina.

## 2. Struktura pisanog rada (veza kod ↔ poglavlja)

Kod treba da olakša pisanje sledećih poglavlja, pa vodi računa da postoje artefakti za svako:

| Poglavlje                                                                                      | Šta kod/projekat treba da obezbedi                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Uvod: motivacija, analiza tržišta (npr. Zendesk, Freshdesk, Jira Service Management, osTicket) | —                                                                                     |
| Opis i izbor tehnologija (Next.js i biblioteke)                                                | `package.json` sa jasnim, obrazloživim zavisnostima; bez suvišnih biblioteka          |
| Zahtevi sistema: funkcionalni, nefunkcionalni, ostali                                          | Sekcija 4 ovog fajla; održavaj je ažurnom                                             |
| Implementacija: slučajevi korišćenja                                                           | Svaki use case mapiran na rutu/stranicu                                               |
| Arhitektura projekta                                                                           | Čista podela slojeva (sekcija 5), dijagram se izvodi iz koda                          |
| Struktura projekta                                                                             | Predvidljiva struktura foldera (sekcija 5)                                            |
| Obrada izuzetaka                                                                               | Centralizovana obrada grešaka (sekcija 6)                                             |
| Testiranje aplikacije                                                                          | Unit, integracioni i E2E testovi + Postman kolekcija za API (Postman je u literaturi) |
| Demonstracija funkcionalnosti                                                                  | Seed podaci i demo nalozi za svaku ulogu                                              |
| Uputstvo za korisnike                                                                          | Funkcionalnosti moraju biti razumljive bez objašnjenja koda                           |

Literatura iz apstrakta pokriva: Next.js dokumentaciju, API arhitekturu, WebSocket real-time aplikacije, RBAC (Sandhu et al., 1996) i Postman testiranje. Rešenja treba da se mogu opravdati ovim izvorima.

## 3. Tehnološki stek

**Potvrđeno apstraktom:** Next.js, React, Supabase (baza), WebSocket, Next.js API rute.

**Predlog (čeka potvrdu — vidi Otvorena pitanja):**

- **Jezik:** TypeScript (strict mode) — **odlučeno**
- **Next.js:** App Router (`app/`), Server Components gde ima smisla, Route Handlers (`app/api/**/route.ts`) kao "API rute"
- **Baza:** Supabase Postgres, migracije preko Supabase CLI (`supabase/migrations/`)
- **Autentifikacija:** Supabase Auth — **dva načina, oba obavezna:** (1) klasična registracija i prijava email + lozinka, (2) prijava preko **Google naloga** (OAuth). `@supabase/ssr` za sesiju u Next.js
- **Autorizacija:** RBAC — uloga u tabeli `profiles`, provera u `proxy.ts` (Next.js 16+; u starijim verzijama `middleware.ts`), na API rutama i kroz Row Level Security (RLS) politike u bazi
- **Real-time:** **Supabase Realtime** (radi preko WebSocket-a). **Odlučeno.** Mora ostati zamenljivo sopstvenim WebSocket serverom (npr. Socket.IO) ako mentor to zatraži — vidi "Real-time sloj" ispod.
- **Višejezičnost:** `next-intl`, jezici **engleski i srpski**, dugme za promenu jezika u zaglavlju
- **UI:** **Tailwind CSS** (odlučeno); shadcn/ui (komponente nad Tailwind-om) kao pomoć za forme, tabele i dijaloge
- **Validacija:** Zod (deljene šeme za formu i API)
- **API dokumentacija:** **Swagger / OpenAPI 3** (odlučeno) — vidi "API dokumentacija (Swagger)" ispod
- **Grafikoni za analitiku:** Recharts
- **Testovi:** Vitest + React Testing Library (unit/komponente), Playwright (E2E), Postman kolekcija (API)
- **Kvalitet koda:** ESLint, Prettier
- **Deploy:** **Vercel ili Netlify** (konačan izbor kasnije) + Supabase cloud. Kod mora raditi na obe platforme: ne koristiti API-je specifične za jednu platformu (npr. `@vercel/*` paketi, Vercel KV/Edge Config, Netlify Functions); sve konfiguracije kroz env promenljive opisane u `.env.example`.

### API dokumentacija (Swagger)

Cilj: da se na odbrani i u radu jasno vidi koje sve API pozive aplikacija ima, i da se mogu isprobati uživo.

- Specifikacija u formatu **OpenAPI 3**, generisana iz istih **Zod šema** koje se koriste za validaciju (`@asteasolutions/zod-to-openapi`), tako da dokumentacija uvek odgovara stvarnom kodu i ne piše se ručno dvaput.
- `GET /api/openapi` vraća OpenAPI JSON; stranica **`/api-docs`** prikazuje **Swagger UI** (`swagger-ui-react`) gde se vide i isprobavaju svi pozivi.
- Svaka ruta u Swaggeru ima: kratak opis (srpski), **tag** po domenu (`Auth`, `Tickets`, `Comments`, `Notifications`, `Analytics`, `Admin`), šemu ulaza i izlaza, primer, moguće greške (400/401/403/404/500) i koje **uloge** smeju da je pozovu.
- Autorizacija u Swagger UI: dugme "Authorize" sa Supabase JWT tokenom (bearer), da se pozivi mogu isprobati kao `korisnik`, `agent` ili `admin`.
- Swagger UI je dostupan u razvoju i na demo okruženju za odbranu (otvoreno: da li ga sakriti u produkciji).
- Iz iste specifikacije se može izvesti i Postman kolekcija (import OpenAPI JSON u Postman), pa su Swagger i Postman uvek usklađeni.

### Real-time sloj (zamenljiv)

Komponente i hook-ovi **nikad ne pozivaju Supabase Realtime direktno**. Sav real-time ide kroz jedan interfejs u `src/lib/realtime/`:

```ts
// src/lib/realtime/types.ts
export interface RealtimeProvider {
  subscribe<T>(channel: string, event: string, handler: (payload: T) => void): () => void; // vraća unsubscribe
}

// src/lib/realtime/server.ts — SAMO na serveru (servisni sloj), posle uspešnog upisa u bazu
export interface RealtimePublisher {
  publish<T>(channel: string, event: string, payload: T): Promise<void>;
}
```

- **Klijent samo sluša (`subscribe`), nikad ne šalje događaje.** Događaje šalje servis na serveru posle upisa u bazu.
- **Bezbednost:** real-time payload nosi samo ID-jeve i tip događaja (npr. `{ ticketId, event }`), nikad sadržaj. Klijent posle toga učitava podatke kroz API, gde važe RBAC i RLS. Tako interni komentari agenata ne mogu da procure korisniku. Koristiti `postgres_changes` nad tabelom `notifications` (poštuje RLS) ili privatne kanale sa Realtime Authorization.
- **Hosting sopstvenog WebSocket servera:** Vercel i Netlify ne mogu da drže stalnu WebSocket vezu. Ako mentor zatraži sopstveni server, on ide kao zaseban mali servis (npr. Render, Railway ili Fly.io) u folderu `realtime-server/`, a Next.js aplikacija ostaje na Vercel/Netlify.

- `supabase-provider.ts` — trenutna implementacija (Supabase Realtime: postgres_changes / broadcast).
- `websocket-provider.ts` — rezervna implementacija za sopstveni WebSocket server; pravi se tek ako mentor zatraži.
- `index.ts` bira provajdera preko env promenljive `NEXT_PUBLIC_REALTIME_PROVIDER=supabase|websocket`.
- Nazivi kanala i događaja su konstante u `src/lib/realtime/events.ts` (`TICKET_UPDATED`, `TICKET_COMMENT_ADDED`, `TICKET_ASSIGNED`, `NOTIFICATION_CREATED`; kanali `ticket:<id>`, `staff`, `user:<id>`), nezavisne od provajdera.
- Zamena provajdera ne sme zahtevati izmenu nijedne komponente.

## 4. Zahtevi sistema

### Uloge (odlučeno: tačno tri)

| Uloga                   | Opis                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Korisnik (`customer`)   | Spoljni klijent koji se sam registruje i prijavljuje probleme; vidi samo svoje zahteve |
| Agent (`agent`)         | Član tima podrške; vidi dodeljene i nedodeljene zahteve, menja status, komentariše     |
| Administrator (`admin`) | Sve što i agent, plus upravlja korisnicima, ulogama, kategorijama; vidi svu analitiku  |

Vrednosti u zagradi su vrednosti enum-a `user_role` u bazi i kodu (identifikatori na engleskom); u interfejsu se prikazuju prevedeno. Ne dodavati nove uloge bez Milutinove saglasnosti.

### Funkcionalni zahtevi

**Autentifikacija i nalozi**

- FZ-1 Javna registracija (eksterna podrška: svako može da otvori nalog), potvrda email adrese, prijava, odjava, reset lozinke. Samoregistracija uvek dodeljuje ulogu `korisnik`; naloge `agent` i `admin` kreira/unapređuje samo admin. Prvi admin se kreira kroz seed. Na stranicama za prijavu i registraciju postoji i dugme "Nastavi sa Google nalogom"; prvi Google login automatski pravi profil sa ulogom `korisnik`. **Povezivanje naloga:** ako postoji nalog sa istom email adresom (registrovan emailom), Google prijava se vezuje za taj isti nalog i profil, ne pravi se duplikat.
- FZ-2 Pregled i izmena sopstvenog profila.
- FZ-3 Admin dodeljuje i menja uloge korisnicima.

**Zahtevi (tiketi)**

- FZ-4 Korisnik kreira zahtev: naslov, opis, kategorija, prioritet, opcioni prilog.
- FZ-5 Korisnik vidi listu i detalje svojih zahteva i njihov trenutni status.
- FZ-6 Agent preuzima zahtev ili ga admin dodeljuje agentu.
- FZ-7 Promena statusa kroz definisan tok: `open → in_progress → waiting_on_customer → resolved → closed` (Otvoren, U obradi, Čeka korisnika, Rešen, Zatvoren; uz mogućnost ponovnog otvaranja). Dozvoljeni prelazi po ulogama su u `docs/02-baza-podataka.md` sekcija 4 i u kodu u `src/services/policies/status-transitions.ts` i proveravaju na serveru; tabela ide i u poglavlje rada kao primer RBAC-a. _Potvrđeno (Faza 2): korisnik sme da otkaže svoj otvoren zahtev, potvrdi rešenje i ponovo otvori rešen zahtev._
- FZ-8 Komentari na zahtevu (javni i interni komentari vidljivi samo agentima).
- FZ-9 Istorija promena zahteva (audit log: ko, šta, kada).
- FZ-10 Pretraga, filtriranje (status, prioritet, kategorija, agent) i sortiranje.

**Dashboard**

- FZ-11 Dashboard prilagođen ulozi: korisnik vidi svoje zahteve po statusu; agent vidi svoj red rada; admin vidi pregled svih.

**Obaveštenja u realnom vremenu**

- FZ-12 Obaveštenje kada se promeni status zahteva, stigne novi komentar ili se zahtev dodeli agentu.
- FZ-13 Lista/brojač nepročitanih obaveštenja; liste i detalji zahteva se osvežavaju bez reload-a.

**Analitika**

- FZ-14 Metrike: broj zahteva po statusu/kategoriji/prioritetu, prosečno vreme prvog odgovora, prosečno vreme rešavanja, broj rešenih po agentu, trend kroz vreme.
- FZ-15 Filtriranje analitike po vremenskom periodu.
- FZ-16 **Ocena zadovoljstva (CSAT):** kad zahtev pređe u `resen`, korisnik može da ga oceni 1–5 zvezdica uz opcioni komentar (jednom po zahtevu). Prosečna ocena ukupno i po agentu ulazi u analitiku.

### Nefunkcionalni zahtevi

- NFZ-1 Responzivnost: upotrebljivo na telefonu, tabletu i desktopu (mobile-first).
- NFZ-2 Bezbednost: autorizacija se proverava na serveru i u bazi (RLS), nikad samo u UI-u; tajni ključevi samo na serveru.
- NFZ-3 Performanse: SSR/Server Components za početno učitavanje, paginacija lista.
- NFZ-4 Pristupačnost: semantički HTML, labele na formama, navigacija tastaturom.
- NFZ-5 Održivost: TypeScript strict, jasna podela slojeva, testovi za ključnu logiku.
- NFZ-6 Pouzdanost: korisniku se uvek prikazuje razumljiva poruka o grešci.
- NFZ-7 Višejezičnost: interfejs na engleskom i srpskom, sa dugmetom za promenu jezika; izabrani jezik se pamti (cookie). Nijedan tekst u UI-u nije hardkodovan, svi su u `messages/en.json` i `messages/sr.json`. Srpski se piše **latinicom** (odlučeno).

## 5. Arhitektura i struktura projekta (predlog)

```
/
├── CLAUDE.md
├── README.md                  # pokretanje, env promenljive, demo nalozi
├── .env.example               # bez pravih vrednosti
├── messages/                  # prevodi: en.json, sr.json
├── supabase/
│   ├── migrations/            # SQL migracije (šema, RLS politike, triggeri)
│   └── seed.sql               # demo podaci za odbranu
├── src/
│   ├── app/
│   │   ├── (auth)/            # prijava, registracija, reset lozinke
│   │   ├── (app)/             # zaštićeni deo: dashboard, zahtevi, analitika, admin
│   │   ├── api-docs/          # Swagger UI stranica (prikaz svih API poziva)
│   │   └── api/               # Route Handlers (Next.js API rute)
│   │       └── openapi/       # GET /api/openapi → generisan OpenAPI JSON
│   ├── components/
│   │   ├── ui/                # osnovne komponente (shadcn)
│   │   └── <domen>/           # npr. tickets/, notifications/, analytics/
│   ├── lib/
│   │   ├── supabase/          # klijent za server i za browser
│   │   ├── realtime/          # RealtimeProvider interfejs + supabase/websocket implementacije
│   │   ├── i18n/              # next-intl konfiguracija
│   │   ├── auth/              # helperi za sesiju i proveru uloga (RBAC)
│   │   ├── validation/        # Zod šeme
│   │   ├── openapi/           # registry: registracija svih ruta i šema za Swagger
│   │   └── errors/            # klase grešaka i centralni handler
│   ├── services/              # poslovna logika (tickets, comments, analytics...)
│   ├── hooks/                 # npr. useRealtimeTickets, useNotifications
│   ├── types/                 # deljeni tipovi, generisani tipovi baze
│   └── proxy.ts               # osvežavanje sesije i zaštita ruta (Next.js 16+)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                   # Playwright
├── docs/                      # Mermaid dijagrami za rad: use case, ER, arhitektura, tok statusa, sekvence
└── postman/                   # Postman kolekcija za API
```

**Slojevi:** UI (stranice/komponente) → API rute (`app/api/...`) → `services/` (poslovna logika) → Supabase. **Svaka promena podataka ide kroz API rute; Server Actions se ne koriste** (Server Components smeju da _čitaju_ pozivom istog servisa), jer se ne vide u Swaggeru i Postman-u, a apstrakt obećava API rute. Komponente ne pričaju direktno sa bazom za upis. API rute prihvataju sesiju iz kolačića (aplikacija) i `Authorization: Bearer <JWT>` (Swagger, Postman).

**Osnovne tabele (predlog):** `profiles` (uloga), `tickets` (uključujući `first_response_at`, `resolved_at`, `closed_at` — potrebno za analitiku vremena odgovora i rešavanja; popunjava servis ili triger), `ticket_comments`, `ticket_history`, `ticket_ratings` (CSAT), `categories`, `notifications`, `attachments`.

## 6. Konvencije za kodiranje

- **Jezik koda:** identifikatori, nazivi fajlova i commit poruke na **engleskom**; tekst u interfejsu isključivo kroz prevode (en/sr), nikad direktno u JSX-u.
- **Komentari u kodu (OBAVEZNO — Milutinov zahtev):** svaki kod koji se piše mora imati komentare na **srpskom (latinica)** koji objašnjavaju šta se gde nalazi i šta radi:
  - Na vrhu **svakog fajla** kratak blok-komentar: čemu fajl služi, gde se koristi i sa kojim delovima sistema je povezan.
  - Iznad **svake funkcije, komponente, hook-a, API rute i servisa**: šta radi, ulazni parametri, šta vraća, i ko sme da je pozove (uloga).
  - Unutar funkcija komentari za svaki logički korak (npr. provera sesije, provera uloge, validacija, upis u bazu, slanje real-time događaja).
  - U SQL migracijama komentar iznad svake tabele, kolone sa posebnim značenjem, RLS politike i trigera.
  - Komentari moraju ostati tačni: kad se kod menja, menja se i komentar.
  - Cilj: Milutin mora moći da otvori bilo koji fajl i razume ga bez dodatnog objašnjenja (potrebno za pisanje rada i odbranu).
- **Imenovanje:** komponente `PascalCase.tsx`, ostali fajlovi `kebab-case.ts`, kolone u bazi `snake_case`.
- **TypeScript:** `strict: true`, bez `any`; tipovi baze se generišu iz Supabase-a (`supabase gen types`).
- **Validacija:** svaki ulaz na API ruti prolazi kroz Zod šemu; ista šema se koristi na formi.
- **Swagger:** nijedna API ruta nije gotova dok nije registrovana u OpenAPI registru (`src/lib/openapi/`) sa opisom, tagom, šemama zahteva/odgovora, primerima i mogućim greškama.
- **Obrada grešaka:** API rute vraćaju jedinstven oblik `{ error: { code, message } }`, gde je `code` stabilan kod (npr. `TICKET_NOT_FOUND`, `FORBIDDEN_ROLE`, `INVALID_STATUS_TRANSITION`) koji interfejs **prevodi** preko `messages/*.json` (`errors.<CODE>`); `message` je samo za logove i Swagger. Kodovi su konstante u `src/lib/errors/codes.ts`, sa odgovarajućim HTTP statusom (400/401/403/404/409/500); koristi `error.tsx` i `not-found.tsx` u App Routeru; ne gutati greške tiho.
- **Bezbednost:** RLS uključen na svim tabelama; `service_role` ključ nikad u klijentskom kodu; provera uloge na serveru za svaku zaštićenu akciju.
- **Testovi:** svaka nova poslovna funkcija u `services/` dobija unit test; svaki ključni use case ima E2E test.
- **Testovi RLS pravila (obavezno):** za svaku tabelu test koji dokazuje da `customer` ne vidi/menja tuđe podatke, da `agent` ne vidi admin funkcije i da korisnik ne vidi interne komentare. Pokreću se nad lokalnim Supabase-om (`supabase start`), npr. pgTAP ili Vitest sa klijentima prijavljenim kao različite uloge.
- **Dijagrami:** svaka veća promena (nova tabela, novi tok, nova ruta) ažurira odgovarajući Mermaid dijagram u `docs/`.
- **Demo podaci:** `supabase/seed.sql` (ili skripta `scripts/seed-demo.mts`) pravi realne podatke za ~3–6 meseci: ~100+ tiketa, 3–4 agenta, 15–20 korisnika, različite kategorije, prioriteti, statusi, komentari i ocene, raspoređeni kroz vreme da grafikoni analitike izgledaju realno. Demo nalozi za svaku ulogu u README-u.
- **Git:** mali, fokusirani commit-i; grana po funkcionalnosti; `main` uvek mora da se builduje.
- **Ne dodavati** nove biblioteke bez razloga koji se može navesti u radu (poglavlje "Izbor tehnologija").

## 7. Plan razvoja (predlog redosleda)

1. Postavljanje projekta (Next.js, TS, Tailwind, ESLint, Supabase).
2. Šema baze, migracije, RLS, seed.
3. Autentifikacija i RBAC (middleware, uloge).
4. CRUD zahteva, statusni tok, komentari, istorija.
5. Dashboard po ulogama.
6. Real-time obaveštenja.
7. Analitika.
8. Responzivnost i pristupačnost.
9. Testovi (unit, E2E, Postman) i provera da je svaka ruta prikazana u Swaggeru.
10. Deploy, realni demo podaci, Mermaid dijagrami u `docs/`, materijal za poglavlja rada.

## 8. Budući razvoj i proširenja (NE raditi sada)

Ovo **nije deo obima diplomskog** dok Milutin ne kaže drugačije. Služi za dve stvari: (1) da arhitektura od početka ne zatvara vrata ovim proširenjima, i (2) kao materijal za poglavlje _Zaključak — pravci daljeg razvoja_. Ne implementirati ništa odavde bez izričitog zahteva.

**Faza A — mala proširenja (ako ostane vremena pre odbrane)**

- Javna početna stranica i baza čestih pitanja (FAQ) kao statičke stranice (SSG) — pokazuje i SSG iz apstrakta.
- Prilozi uz zahteve (Supabase Storage, ograničenje veličine i tipa fajla).
- Email obaveštenja (npr. Resend) uz ona u aplikaciji, sa podešavanjem šta korisnik želi da prima.
- Automatska dodela zahteva agentu sa najmanje otvorenih zahteva (round-robin / najmanje opterećen).
- Šabloni odgovora (makroi) za agente za česta pitanja.
- Tamna tema (Tailwind `dark:`).
- Izvoz analitike u CSV/PDF.
- Zaštita od zloupotrebe javne registracije: ograničenje broja zahteva u minuti po korisniku, CAPTCHA.

**Faza B — ozbiljnija proširenja (posle diplomskog)**

- **SLA i eskalacija:** rok za prvi odgovor i rešavanje po prioritetu; upozorenje i automatska eskalacija kad se rok prekorači.
- **Timovi agenata i kategorije po timu** (npr. "Mreža", "Nalozi", "Hardver"), rutiranje zahteva na tim.
- **Baza znanja:** članci koje agenti pišu; pri kreiranju zahteva sistem predlaže relevantne članke pre slanja.
- **Prijem zahteva preko emaila** (email → tiket) i odgovor na tiket direktnim odgovorom na email.
- **Web push obaveštenja i PWA** (instalacija na telefon, rad sa obaveštenjima i kad aplikacija nije otvorena).
- **Dvofaktorska autentifikacija (2FA)** za agente i admine.
- **Integracije:** Slack/Teams obaveštenja za agente, webhook-ovi za spoljne sisteme, javni API sa API ključevima.

**Faza C — napredno / istraživački pravci**

- **AI pomoć:** automatska kategorizacija i predlog prioriteta, predlog odgovora agentu na osnovu baze znanja, sažetak duge prepiske.
- **Čet uživo** između korisnika i agenta (nadogradnja na postojeći real-time sloj).
- **Više organizacija u jednoj aplikaciji (multi-tenant)** — svaka firma ima svoje agente, kategorije i podatke (RLS po `organization_id`).
- **Napredna analitika:** predviđanje opterećenja, mapa najčešćih problema, poređenje agenata kroz vreme.
- **Mobilna aplikacija** (React Native / Expo) nad istim API-jem — moguće jer je sve kroz API rute dokumentovane Swaggerom.

**Tehničko unapređenje (može i tokom rada)**

- CI na GitHub Actions: lint, tipovi, testovi i build na svaki push.
- Praćenje grešaka u produkciji (npr. Sentry) i strukturisani logovi.
- Docker setup za lokalno pokretanje cele aplikacije jednom komandom.
- Keširanje i optimizacija upita za analitiku (materijalizovani pogledi u Postgresu).

**Kako arhitektura već sada priprema proširenja:** sve kroz API rute (mobilna aplikacija, integracije), zamenljiv real-time sloj (čet, push), servisni sloj odvojen od UI-a (AI, email), tabela prelaza statusa (SLA), RLS od prvog dana (multi-tenant).

## 9. Otvorena pitanja (za Milutina — rešiti pre kodiranja)

**Rešeno (20.10.2026):** real-time = Supabase Realtime iza zamenljivog interfejsa; uloge = korisnik/agent/admin; tip = eksterna podrška sa javnom registracijom i prijavom; interfejs = engleski + srpski (latinica) sa dugmetom za promenu; jezik = TypeScript; stil = Tailwind CSS; prijava = email + lozinka i Google nalog; deploy = Vercel ili Netlify; API dokumentacija = Swagger UI na `/api-docs`; sve promene kroz API rute (bez Server Actions); prihvaćeno iz pregleda: CSAT ocene, realni demo podaci, Mermaid dijagrami u `docs/`, testovi RLS pravila, greške kao kodovi koji se prevode, povezivanje email i Google naloga; komentari na srpskom u svakom fajlu.

1. **App Router ili Pages Router?** (Predlog: App Router.)
2. **Deploy:** Vercel ili Netlify — konačan izbor? Da li aplikacija mora biti javno dostupna na odbrani?
3. **Rok** za završetak koda i za predaju rada?
4. **Repozitorijum:** GitHub? Javni ili privatni?
5. **Analitika:** koje metrike su obavezne, i da li je potreban izvoz (CSV/PDF)?
6. **Treći član komisije:** dr Mladen Opačić ili Emilija Kisić (PDF se razlikuje na str. 4 i 5)?
7. **Ko sme da zatvori i ponovo otvori zahtev:** samo agent ili i korisnik?
8. **Server Actions:** potvrditi da sve ide kroz API rute (trenutno tako upisano).
9. **Dijagrami:** da li fakultet traži UML iz alata (npr. Visual Paradigm) ili su dovoljni Mermaid dijagrami?
10. **Mentor i real-time:** da li pitati mentora unapred da li je Supabase Realtime prihvatljiv kao "WebSocket integracija"?

Prilozi i email obaveštenja su prebačeni u sekciju 8 (Faza A) kao opciona proširenja.

## 10. Napomene iz implementacije

- **Next.js 16 + Cache Components:** `cacheComponents` je uključen (podrazumevano u šablonu). Pošto se jezik (a kasnije i sesija) čita iz kolačića, root layout ima `export const instant = false` — stranice se iscrtavaju po zahtevu. Pošto razvojni server inače proverava „instant“ navigaciju na svakoj stranici (upozorenje „Instant“ u `pnpm dev`), `next.config.ts` ima `experimental.instantInsights.validationLevel: "manual-warning"`: proveravaju se samo stranice sa izričitim `instant = true`. Podatke koji su isti za sve (npr. kategorije) keširati sa `"use cache"`. Pre korišćenja nekog Next.js API-ja proveriti dokumentaciju u `node_modules/next/dist/docs/` (vidi `AGENTS.md`), jer se razlikuje od starijih verzija.
- **Višejezičnost:** `next-intl` bez prefiksa jezika u URL-u; konfiguracija u `src/lib/i18n/` (putanja zadata u `next.config.ts`), prevodi u `messages/`. Promena jezika: `LanguageSwitcher` upisuje kolačić `NEXT_LOCALE` i radi `router.refresh()`.
- **Fontovi:** Geist iz npm paketa `geist` (lokalno, bez Google Fonts).
- **shadcn/ui:** komponente se dodaju sa `pnpm dlx shadcn add <naziv>`; ako registar nije dostupan iz okruženja, komponenta se prepisuje ručno u istom obliku (tako su urađeni `button` i `card` u Fazi 1).
- **React Compiler ESLint pravila** su uključena (npr. zabrana menjanja globalnih objekata u telu komponente) — takav kod izdvojiti u pomoćnu funkciju.
- **Baza (Faza 2):** sve izmene zahteva, komentara, istorije, ocena i obaveštenja idu kroz RPC funkcije (`security definer`, `set search_path = ''`) koje same proveravaju `auth.uid()`, ulogu i pristup; uloga `authenticated` nad tim tabelama ima samo SELECT (i `notifications.is_read`). Greške iz baze: `raise exception using message = '<KOD>', errcode = 'P0001'` — servis čita `error.message` kao `ErrorCode`. Interne funkcije su u šemi `private`. Imena korisnika za prikaz uz komentare čitaju se iz pogleda `profile_summaries` (bez emaila).
- **Tipovi baze:** `pnpm db:types` (traži pokrenut lokalni Supabase); CI posao `db` pada ako `src/types/database.ts` nije ažuran. Testovi baze: `pnpm test:db` (`tests/integration/`).
- **API infrastruktura (Faza 3):** svaka ruta je `withApi({ roles, body?, query?, params?, successStatus? }, handler)` iz `src/lib/api/with-api.ts`; `roles: "public"` za rute bez prijave (tada je `ctx` null). Rezultat handlera: objekat -> JSON, `undefined` -> 204, `Response` -> prosleđuje se. Greške iz baze u servisima pretvarati sa `fromDbError(error)`. Swagger dokumentacija rute ide u `src/lib/openapi/routes/<domen>.ts` (i u `routes/index.ts`); primeri grešaka preko `errorResponses([...])`. Real-time: `publisher.publish(kanal, događaj, { ticketId, actorId })`; obaveštenja klijent sluša preko `postgres_changes` (događaj `NOTIFICATION_CREATED` na `user:<id>`). Testovi: `tests/unit` (`pnpm test:unit`) i `tests/integration` (`pnpm test:db`), Vitest projekti u `vitest.config.mts`.
- **Prijava i stranice (Faza 4):** `AuthService` (`src/services/auth/`) jedini radi bez `ServiceContext` (dobija Supabase klijent iz kolačića); greške Supabase Auth-a idu kroz `mapAuthError`. Serverske stranice proveravaju korisnika sa `requireCurrentUser()` / `requirePageRole()` iz `src/lib/auth/server-session.ts` (sadrži `await connection()`, jer Supabase klijent koristi `Date.now()`, što Cache Components ne dozvoljava pri unapred pripremljenom prikazu). `proxy.ts` samo preusmerava po prijavi (pravila u `src/lib/auth/route-access.ts`); uloga se proverava u `layout.tsx` (`/admin`, `/analytics`) i u API-ju. Forme: react-hook-form + `zodResolver` sa istom Zod šemom; poruke grešaka u šemama su ključevi prevoda (`validation.<ključ>`), a `applyApiError` upisuje greške iz API-ja ispod polja. Potvrda emaila je uključena; linkovi iz emailova (`supabase/templates/`) koriste `token_hash` (rade na drugom uređaju). Lokalni emailovi: Mailpit (http://127.0.0.1:54324). Google prijava je u kodu, a ključevi se podešavaju po README-u.
- **Zahtevi (Faza 5a):** pravila su u `src/services/policies/` (`StatusTransitionPolicy` = tabela prelaza iz docs/02, `TicketAccessPolicy` = ko sme šta + polje `permissions` u `GET /api/tickets/{id}`, po kome UI prikazuje dugmad). Servisi pre RPC poziva proveravaju pravila (jasna greška), a baza ih proverava ponovo. Imena korisnika i kategorije uz zahteve se učitavaju posebnim upitom (`src/services/shared/lookups.ts`, pogled `profile_summaries`), ne spajanjem tabela. Sve izmene zahteva vraćaju `TicketDetail` (sa novim `permissions`). Real-time događaji idu kroz `publishTicketEvent` (`src/services/shared/publish.ts`): interna beleška samo na kanal `staff`; neuspeh slanja se samo beleži. Prazni query parametri (`?status=`) se tretiraju kao neposlati (`withApi`). Pretraga `q`: `#1042` po broju, inače reči kao „počinje sa“ preko `search_vector`. Seed ima 12 demo zahteva (#1001–#1012).
- **Stranice zahteva (Faza 5b):** `/tickets`, `/tickets/new` (samo korisnik), `/tickets/[id]`. Stranice čitaju preko servisa (`requireCurrentUser()` -> `new TicketService(ctx)`), a izmene idu kroz API preko hook-a `useApiAction` (poruka + `router.refresh()`). Filteri liste su u adresi (`src/components/tickets/list-params.ts`, ista Zod šema kao API). Dugmad na stranici zahteva prate `permissions`; naziv dugmeta za prelaz daje `transitionLabelKey` (npr. korisnik „Potvrdi rešenje“, tim „Zatvori zahtev“). Polja forme: `FormField`, `FormTextareaField`, `FormSelectField`. Datumi se prikazuju u zoni `Europe/Belgrade` (`APP_TIME_ZONE`). Nepostojeći ili tuđi zahtev daje `not-found.tsx`.
- **Kontrolni panel (Faza 6):** `DashboardService.getForCurrentUser()` vraća `DashboardData` sa poljem `kind` (customer, agent, admin); stranica `/dashboard` i `GET /api/dashboard` koriste isti servis. Brojeve računa baza (`ticket_counts()`, `agent_dashboard_stats()`, pod RLS-om), a sabiranje je čista funkcija `summarizeCounts` (`src/services/dashboard/dashboard-counts.ts`). Filter liste `status=unresolved` znači sve nerešene (`UNRESOLVED_TICKET_STATUSES` u `src/types/domain.ts`); na njega vode brojevi sa panela. Osvežavanje panela bez reload-a dolazi u Fazi 7.
- **Obaveštenja (Faza 7):** `NotificationService` + rute `GET /api/notifications`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all` (obaveštenja pravi baza, servis ih samo čita i označava). Zvonce (`NotificationBell`, padajući prozor = shadcn `popover`) i stranica `/notifications`; tekst iz prevoda `notifications.types.<type>`. Real-time u pregledaču ide kroz `useRealtimeEvents` (hook-ovi `useNotifications`, `useTicketRealtime`, `useStaffRealtime`), a posle događaja `router.refresh()` grupisan u 300 ms (`useDebouncedRefresh`). `SupabaseRealtimeProvider` drži jedan kanal po nazivu (Supabase ne dozvoljava dvostruku pretplatu) i pre pretplate daje Realtime-u token sesije; `SupabaseRealtimePublisher` šalje sa tokenom iz `Authorization` zaglavlja ili sesije (bez tokena privatni kanal odbija pošiljaoca). Testovi nad pravim Realtime-om: `tests/integration/realtime.test.ts` (rade u CI-u; bez Realtime servera `REALTIME_TESTS=off`). Seed ima demo obaveštenja (nova su nepročitana).
- **Analitika (Faza 8a):** `AnalyticsService` (samo admin; konstruktor baca `FORBIDDEN`) poziva RPC `analytics_overview`, `analytics_by_dimension`, `analytics_agents`, `analytics_trend` (migracija `..._analytics.sql`, `security invoker` + provera admina u `analytics_bounds`). Period su DATUMI `from`/`to` (dani po Beogradu, oba uključena, najviše 366, podrazumevano 30 dana); pravila su u `src/lib/analytics/period.ts` i ista u bazi. Sva vremena u minutima; proseci `null` kad nema podataka; nule i nazive kategorija dodaje `analytics-mappers.ts`. Stranica `/analytics` čita na serveru (period u adresi), grafikoni su klijentske komponente u `src/components/analytics/` (Recharts; `react-is` je njegova obavezna peer zavisnost). Boje grafikona: `--color-chart-1/2` u `globals.css` (naziv `--color-*` jer Tailwind briše neiskorišćene obične promenljive); srpski datumi sa nazivom meseca traže `sr-Latn` (samo `sr` daje ćirilicu). Demo podaci: `pnpm seed:demo` (`scripts/seed-demo.mts`, Node bez dodatnih paketa, service_role), deterministički, briše samo zahteve demo korisnika (ID-jevi `...-8001-...`); CI ga pokreće dva puta.
- **Administracija (Faza 8b):** `UserAdminService.list/update` (rute `/api/admin/users`, izmena ide kroz RPC `admin_update_user`, koji oslobađa zahteve bivšeg člana tima) i `CategoryService.create/update` (rute `/api/admin/categories`; duplikat oznake = Postgres `23505` -> `CATEGORY_SLUG_TAKEN`). Stranice `/admin/users` (filteri u adresi, `user-list-params.ts`) i `/admin/categories`; komponente u `src/components/admin/`. Dijalog = `src/components/ui/dialog.tsx` (shadcn, nad postojećim `@radix-ui/react-dialog`). Potvrda pre izmene naloga: uvek pri deaktivaciji, a pri promeni uloge kad se zahtevi vraćaju u red (`user-change.ts`, isto pravilo kao u bazi). Sopstveni red je zaključan. Kategorije se ne brišu, nego deaktiviraju.
- **Kanban tabla (posle Faze 8):** `/tickets?view=board` (`parseTicketView` u `list-params.ts`), komponente `TicketViewToggle`, `TicketBoard`, `BoardColumn`, `BoardCard`. Pet kolona se učitava paralelno preko `TicketService.list` (`BOARD_COLUMN_LIMIT` = 20, link „Prikaži sve“ na listu po statusu). Dozvoljene kolone daje `boardDropTargets` iz `board-rules.ts` nad `StatusTransitionPolicy`; jedini izuzetak je preuzimanje (agent, nedodeljen otvoren zahtev -> „U obradi“ = `POST /assign`). Kartica se premesti odmah (`applyBoardMoves`), a vraća se ako API odbije; nove serverske kolone brišu privremena premeštanja. Biblioteka `@dnd-kit/core` (miš, dugi pritisak na telefonu, tastatura Space/strelice/Escape, najave za čitač ekrana iz prevoda `tickets.board.announce`). Kartica ostaje link: Enter otvara, Space podiže.
- **Testiranje (Faza 9):** izveštaj za rad je `docs/08-testiranje.md` (ažurirati brojeve kad se dodaju testovi). RLS matrica: `tests/integration/rls/` (jedan fajl po tabeli, nazivi testova počinju ćelijom, npr. `SELECT · korisnik`), direktno nad PostgREST-om; pomoćne `expectPermissionDenied` (42501) i `expectNoRows` (politika filtrira) u `rls-helpers.ts`. Pokrivenost: `pnpm test:coverage` (`@vitest/coverage-v8`; mere se `src/services`, `src/lib`, `src/app/api`), CI posao `db` je pokreće i čuva artefakt `coverage`.
- **E2E (Faza 9b):** Playwright (`@playwright/test`, `playwright.config.ts`), testovi u `tests/e2e/` (pomoćne u `helpers.ts`: `login`, `newSession` = poseban kontekst po korisniku, `createTicketViaForm`, Mailpit link). `pnpm test:e2e` pokreće `pnpm start` na :3000 (ili koristi `E2E_BASE_URL`); jedan radnik, svaki test pravi svoj zahtev. Lokatori su po vidljivom (srpskom) tekstu i ulogama, kao što korisnik vidi stranicu. CI posao `e2e` čuva artefakt `playwright-report`.
- **Postman (Faza 9c):** kolekciju `postman/helpdesk.postman_collection.json` pravi `pnpm postman:generate` (`scripts/postman-generate.mts`, aplikacija mora da radi; `OPENAPI_URL`) iz scenarija u skripti + opisa i šema iz `/api/openapi`; ručno se ne menja. Svaka OpenAPI operacija mora imati bar jedan poziv u scenariju (inače skripta pada), pa **nova ruta = novi poziv u `SCENARIO`** i ponovno generisanje. Pozivi idu samo sa Bearer tokenom (`disableCookies`), gost bez tokena. `pnpm test:api` = newman nad `local` okruženjem; CI posao `api` radi `--check` i dva prolaza newman-a.
- **Responzivnost i pristupačnost (Faza 10a):** raspored u kolonama koji stoji pored bočnog menija počinje od `lg`, ne od `md` (na tabletu meni zauzima ~240 px); `tests/e2e/responsive.spec.ts` proverava sve stranice na 390/768/1280 px. Recharts grafikoni su `aria-hidden` (podaci u tabeli), zato `accessibilityLayer={false}`. `DialogContent` vraća fokus na element fokusiran pre otvaranja (i bez `DialogTrigger`). Lighthouse Accessibility = 100 na svim stranicama (docs/08, sekcija 7).
- **Dokumentacija za rad (Faza 10b):** `docs/01`–`06` su usklađeni sa kodom (infrastruktura je na dijagramu klasa prikazana kao `<<module>>` sa funkcijama; nazivi AuthGuard, ApiErrorHandler i SupabaseClientFactory su nazivi modula iz komentara u kodu). PNG dijagrami u `docs/img/<dokument>-NN.png` se ponovo izvoze posle svake izmene Mermaid bloka (`@mermaid-js/mermaid-cli`; u sekvencnim dijagramima ne koristiti `;` u tekstu poruke, to je separator). Uputstvo za korisnike: `docs/09-uputstvo-za-korisnike.md`, snimci u `docs/img/uputstvo/` (srpski, desktop i par telefona), a svi snimci (oba jezika) u folderu projekta `diplomski/faza-10/snimci/`.
- **Deploy (Faza 10c):** Vercel + Supabase cloud (Frankfurt), uputstvo `docs/10-deploy.md`. Na Vercel idu samo `NEXT_PUBLIC_*` promenljive i `SWAGGER_ENABLED=true` (Swagger ostaje uključen za odbranu); `service_role` ključ se koristi samo lokalno za `seed:demo` nad cloud bazom. Šema i `seed.sql` idu sa `supabase db push --include-seed`; šabloni emailova se na cloud-u nalepe ručno. Ugrađeni Supabase email šalje samo članovima tima, pa je za registraciju na demou preporučen sopstveni SMTP (Brevo). Region funkcija na Vercel-u: `fra1`.
