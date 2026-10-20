# 06 — API specifikacija i stranice

Spisak svih API ruta i stranica aplikacije. Ova tabela je izvor za Swagger (OpenAPI registar), Postman kolekciju i poglavlje rada o arhitekturi. Kad se doda ruta u kod, dodaje se i ovde.

## 1. Opšta pravila API-ja

- Osnova: `/api`. Format: JSON (`Content-Type: application/json`), osim OAuth preusmerenja.
- Autentifikacija: kolačić Supabase sesije (aplikacija) **ili** `Authorization: Bearer <access_token>` (Swagger, Postman).
- Jezik: `Accept-Language: sr | en` (samo za `message` u greškama; UI prevodi po `code`).
- Nazivi polja u JSON-u: `camelCase`. Datumi: ISO 8601 u UTC.
- Paginacija: `?page=1&pageSize=20` (max 100) → odgovor `{ items, page, pageSize, total }`.
- Greška: `{ "error": { "code": "TICKET_NOT_FOUND", "message": "...", "details": {...} } }`.
- Uspešan odgovor: objekat direktno (bez omotača `data`), `201` za kreiranje, `204` za akcije bez tela.

| HTTP status | Kada                         | Primer koda                                                                                                                                                                             |
| ----------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400         | neispravan ulaz              | `VALIDATION_ERROR` (u `details.fields` greške po poljima)                                                                                                                               |
| 401         | nema sesije                  | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`                                                                                                                                                |
| 403         | nema prava                   | `FORBIDDEN`, `ACCOUNT_DISABLED`, `NOT_ASSIGNED_AGENT`, `FORBIDDEN_INTERNAL_COMMENT`, `EMAIL_NOT_CONFIRMED`                                                                              |
| 404         | ne postoji ili nije vidljivo | `NOT_FOUND`, `TICKET_NOT_FOUND`                                                                                                                                                         |
| 409         | konflikt stanja              | `INVALID_STATUS_TRANSITION`, `TICKET_ALREADY_ASSIGNED`, `ASSIGNEE_NOT_AGENT`, `TICKET_CLOSED`, `ALREADY_RATED`, `TICKET_NOT_RESOLVED`, `EMAIL_ALREADY_REGISTERED`, `CANNOT_MODIFY_SELF` |
| 429         | previše zahteva              | `RATE_LIMITED` (Faza A)                                                                                                                                                                 |
| 500         | neočekivana greška           | `INTERNAL_ERROR`                                                                                                                                                                        |

Napomena: zahtev koji korisnik nema pravo da vidi vraća **404**, a ne 403, da se ne otkrije da postoji.

## 2. Rute

Legenda uloga: **G** gost, **C** customer (korisnik), **A** agent, **AD** admin.

### Auth (tag `Auth`)

| Metod i putanja                  | Uloge           | Telo / parametri                | Odgovor                                  | UC           |
| -------------------------------- | --------------- | ------------------------------- | ---------------------------------------- | ------------ |
| `POST /api/auth/register`        | G               | `{ fullName, email, password }` | `201`                                    | UC-01        |
| `POST /api/auth/login`           | G               | `{ email, password }`           | `200 { profile }` + kolačić              | UC-02        |
| `POST /api/auth/logout`          | C A AD          | —                               | `204`                                    | UC-05        |
| `GET /api/auth/google`           | G               | `?next=/dashboard`              | `302` na Google                          | UC-03        |
| `GET /api/auth/callback`         | G               | `?code=...&next=`               | `302` na `next` (potvrda emaila i OAuth) | UC-01, UC-03 |
| `POST /api/auth/password/forgot` | G               | `{ email }`                     | `204` (uvek, i ako email ne postoji)     | UC-04        |
| `POST /api/auth/password/reset`  | sesija iz linka | `{ password }`                  | `204`                                    | UC-04        |

### Profil (tag `Profile`)

| Metod i putanja | Uloge  | Telo / parametri         | Odgovor   | UC           |
| --------------- | ------ | ------------------------ | --------- | ------------ |
| `GET /api/me`   | C A AD | —                        | `Profile` | UC-06        |
| `PATCH /api/me` | C A AD | `{ fullName?, locale? }` | `Profile` | UC-06, UC-07 |

### Zahtevi (tag `Tickets`)

| Metod i putanja                 | Uloge                                    | Telo / parametri                                                                                                                | Odgovor                                                                                                                                      | UC                  |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `GET /api/tickets`              | C A AD                                   | `?status&priority&categoryId&assigneeId(me\|unassigned\|uuid)&q&sort(createdAt\|-createdAt\|priority\|updatedAt)&page&pageSize` | `Paginated<TicketListItem>` (korisnik: samo svoje)                                                                                           | UC-10, UC-15, UC-19 |
| `POST /api/tickets`             | C                                        | `{ title, description, categoryId, priority }`                                                                                  | `201 Ticket`                                                                                                                                 | UC-09               |
| `GET /api/tickets/{id}`         | C A AD                                   | —                                                                                                                               | `TicketDetail` = `TicketWithRelations` + `permissions { allowedTransitions[], canComment, canCommentInternal, canAssign, canRate, canEdit }` | UC-11               |
| `PATCH /api/tickets/{id}`       | A AD (C dok je `open`, samo naslov/opis) | `{ title?, description?, categoryId?, priority? }`                                                                              | `Ticket`                                                                                                                                     | —                   |
| `POST /api/tickets/{id}/status` | C A AD                                   | `{ status }`                                                                                                                    | `TicketDetail`                                                                                                                               | UC-13, UC-17        |
| `POST /api/tickets/{id}/assign` | A AD                                     | `{ assigneeId }` (agent: samo svoj id)                                                                                          | `TicketDetail`                                                                                                                               | UC-16, UC-20        |
| `GET /api/tickets/{id}/history` | C A AD                                   | —                                                                                                                               | `TicketHistoryEntry[]` (sa imenom aktera)                                                                                                    | UC-11               |

### Komentari (tag `Comments`)

| Metod i putanja                   | Uloge  | Telo / parametri        | Odgovor                                       | UC           |
| --------------------------------- | ------ | ----------------------- | --------------------------------------------- | ------------ |
| `GET /api/tickets/{id}/comments`  | C A AD | —                       | `CommentWithAuthor[]` (korisnik bez internih) | UC-11        |
| `POST /api/tickets/{id}/comments` | C A AD | `{ body, isInternal? }` | `201 CommentWithAuthor`                       | UC-12, UC-18 |

### Ocene (tag `Ratings`)

| Metod i putanja                 | Uloge | Telo / parametri            | Odgovor            | UC    |
| ------------------------------- | ----- | --------------------------- | ------------------ | ----- |
| `POST /api/tickets/{id}/rating` | C     | `{ score (1-5), comment? }` | `201 TicketRating` | UC-14 |

### Obaveštenja (tag `Notifications`)

| Metod i putanja                     | Uloge  | Telo / parametri            | Odgovor                                       | UC    |
| ----------------------------------- | ------ | --------------------------- | --------------------------------------------- | ----- |
| `GET /api/notifications`            | C A AD | `?page&pageSize&unreadOnly` | `Paginated<NotificationItem>` + `unreadCount` | UC-08 |
| `POST /api/notifications/{id}/read` | C A AD | —                           | `204`                                         | UC-08 |
| `POST /api/notifications/read-all`  | C A AD | —                           | `204`                                         | UC-08 |

`NotificationItem` sadrži `type`, `ticketId`, `ticketNumber`, `ticketTitle`, `actorName`, `isRead`, `createdAt` — tekst sastavlja UI iz prevoda (`notifications.<type>`), npr. „{actorName} je promenio status zahteva #{ticketNumber}“.

### Kategorije (tag `Categories`)

| Metod i putanja                    | Uloge  | Telo / parametri                                                       | Odgovor        | UC           |
| ---------------------------------- | ------ | ---------------------------------------------------------------------- | -------------- | ------------ |
| `GET /api/categories`              | C A AD | `?includeInactive` (samo AD)                                           | `Category[]`   | UC-09, UC-22 |
| `POST /api/admin/categories`       | AD     | `{ slug, nameEn, nameSr, descriptionEn?, descriptionSr?, sortOrder? }` | `201 Category` | UC-22        |
| `PATCH /api/admin/categories/{id}` | AD     | iste kolone + `isActive`                                               | `Category`     | UC-22        |

### Administracija (tag `Admin`)

| Metod i putanja               | Uloge | Telo / parametri                 | Odgovor                                                                      | UC    |
| ----------------------------- | ----- | -------------------------------- | ---------------------------------------------------------------------------- | ----- |
| `GET /api/admin/users`        | AD    | `?q&role&isActive&page&pageSize` | `Paginated<Profile>`                                                         | UC-21 |
| `PATCH /api/admin/users/{id}` | AD    | `{ role?, isActive? }`           | `Profile`                                                                    | UC-21 |
| `GET /api/agents`             | A AD  | —                                | `ProfileSummary[]` (aktivni agenti i admini, sa brojem otvorenih dodeljenih) | UC-20 |

### Dashboard i analitika (tagovi `Dashboard`, `Analytics`)

| Metod i putanja                   | Uloge  | Telo / parametri                                 | Odgovor                                                                       | UC    |
| --------------------------------- | ------ | ------------------------------------------------ | ----------------------------------------------------------------------------- | ----- |
| `GET /api/dashboard`              | C A AD | —                                                | `DashboardData` (oblik zavisi od uloge, polje `kind: customer\|agent\|admin`) | UC-25 |
| `GET /api/analytics/overview`     | AD     | `?from&to`                                       | `AnalyticsOverview`                                                           | UC-23 |
| `GET /api/analytics/by-dimension` | AD     | `?from&to&dimension(status\|category\|priority)` | `CountItem[]`                                                                 | UC-23 |
| `GET /api/analytics/agents`       | AD     | `?from&to`                                       | `AgentStats[]`                                                                | UC-23 |
| `GET /api/analytics/trend`        | AD     | `?from&to&bucket(day\|week)`                     | `TrendPoint[]`                                                                | UC-23 |

### Dokumentacija (tag `Docs`)

| Metod i putanja            | Uloge                                            | Odgovor        |
| -------------------------- | ------------------------------------------------ | -------------- |
| `GET /api/openapi`         | svi                                              | OpenAPI 3 JSON |
| `GET /api-docs` (stranica) | svi u razvoju/demo; produkcija: otvoreno pitanje | Swagger UI     |

## 3. Zod šeme (u `src/lib/validation/`)

| Fajl            | Šeme                                                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.ts`       | `registerSchema` (fullName 2–100, email, password min 8 + slovo + broj, confirmPassword samo na klijentu), `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`                                                                   |
| `profile.ts`    | `updateProfileSchema` (`fullName?`, `locale?` enum)                                                                                                                                                                                       |
| `tickets.ts`    | `createTicketSchema` (title 5–150, description 10–5000, categoryId uuid, priority enum), `updateTicketSchema` (sve opciono, bar jedno polje), `ticketListQuerySchema`, `changeStatusSchema`, `assignTicketSchema`, `ticketIdParamsSchema` |
| `comments.ts`   | `addCommentSchema` (body 1–5000, isInternal default false)                                                                                                                                                                                |
| `ratings.ts`    | `rateTicketSchema` (score int 1–5, comment max 1000)                                                                                                                                                                                      |
| `categories.ts` | `categorySchema`, `updateCategorySchema`                                                                                                                                                                                                  |
| `admin.ts`      | `userListQuerySchema`, `adminUpdateUserSchema` (bar jedno polje)                                                                                                                                                                          |
| `analytics.ts`  | `dateRangeQuerySchema` (from < to, max 366 dana, podrazumevano poslednjih 30), `byDimensionQuerySchema`, `trendQuerySchema`                                                                                                               |
| `common.ts`     | `paginationSchema`, `uuidSchema`                                                                                                                                                                                                          |

Svaka šema se koristi na tri mesta: forma (react-hook-form + `zodResolver`), API ruta (`withApi`) i OpenAPI registar (`.openapi({ example })`).

## 4. Stranice (App Router)

| Putanja             | Fajl                                  | Pristup         | Render                   | Sadržaj                                                                                                  |
| ------------------- | ------------------------------------- | --------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `/`                 | `app/page.tsx`                        | svi             | statički (SSG)           | Kratka početna: šta je aplikacija, dugmad Prijava/Registracija; prijavljenog preusmerava na `/dashboard` |
| `/login`            | `app/(auth)/login/page.tsx`           | gost            | SSR                      | Email + lozinka, „Nastavi sa Google nalogom“, link na registraciju i zaboravljenu lozinku                |
| `/register`         | `app/(auth)/register/page.tsx`        | gost            | SSR                      | Forma + Google dugme                                                                                     |
| `/forgot-password`  | `app/(auth)/forgot-password/page.tsx` | gost            | SSR                      | Unos emaila                                                                                              |
| `/reset-password`   | `app/(auth)/reset-password/page.tsx`  | sesija iz linka | SSR                      | Nova lozinka                                                                                             |
| `/dashboard`        | `app/(app)/dashboard/page.tsx`        | C A AD          | SSR + real-time          | Dashboard po ulozi (UC-25)                                                                               |
| `/tickets`          | `app/(app)/tickets/page.tsx`          | C A AD          | SSR + klijentski filteri | Lista, filteri u URL-u, paginacija                                                                       |
| `/tickets/new`      | `app/(app)/tickets/new/page.tsx`      | C               | SSR                      | Forma za novi zahtev                                                                                     |
| `/tickets/[id]`     | `app/(app)/tickets/[id]/page.tsx`     | C A AD          | SSR + real-time          | Detalji, akcije, komentari, istorija, ocena                                                              |
| `/notifications`    | `app/(app)/notifications/page.tsx`    | C A AD          | SSR + real-time          | Sva obaveštenja                                                                                          |
| `/profile`          | `app/(app)/profile/page.tsx`          | C A AD          | SSR                      | Ime, jezik, (lozinka ako nije Google nalog)                                                              |
| `/analytics`        | `app/(app)/analytics/page.tsx`        | AD              | klijentski grafikoni     | UC-23                                                                                                    |
| `/admin/users`      | `app/(app)/admin/users/page.tsx`      | AD              | SSR                      | UC-21                                                                                                    |
| `/admin/categories` | `app/(app)/admin/categories/page.tsx` | AD              | SSR                      | UC-22                                                                                                    |
| `/api-docs`         | `app/api-docs/page.tsx`               | vidi gore       | klijent                  | Swagger UI                                                                                               |

Zaštita stranica: `proxy.ts` preusmerava neprijavljene sa `(app)` na `/login?next=...` i prijavljene sa `(auth)` na `/dashboard`. Provera uloge za `/analytics` i `/admin/*` radi se u `layout.tsx` tih foldera (server), a ne samo sakrivanjem linka u meniju.

Meni po ulozi:

| Stavka                             | Korisnik       | Agent                                       | Admin     |
| ---------------------------------- | -------------- | ------------------------------------------- | --------- |
| Dashboard                          | da             | da                                          | da        |
| Moji zahtevi / Zahtevi             | „Moji zahtevi“ | „Zahtevi“ (filteri: moji, nedodeljeni, svi) | „Zahtevi“ |
| Novi zahtev                        | da             | —                                           | —         |
| Analitika                          | —              | —                                           | da        |
| Korisnici, Kategorije              | —              | —                                           | da        |
| API dokumentacija                  | —              | —                                           | da        |
| Obaveštenja, Profil, Jezik, Odjava | da             | da                                          | da        |
