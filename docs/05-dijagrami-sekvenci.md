# 05 — Dijagrami sekvenci (detaljni)

Za razliku od sistemskih dijagrama (`04`), ovde se vidi kako objekti unutar sistema sarađuju: stranica → `ApiClient` → API ruta (`withApi`) → `AuthGuard` → servis → politika → Supabase (RPC/RLS) → real-time → klijent. Nazivi klasa, modula i metoda odgovaraju `03-dijagram-klasa.md` i kodu (usklađeno u Fazi 10).

## SD-01 Zajednički tok svake zaštićene API rute

Ovaj obrazac važi za **sve** rute ispod; u ostalim dijagramima je skraćen na „withApi (auth + validacija)“.

```mermaid
sequenceDiagram
    autonumber
    participant C as Klijent (browser / Swagger)
    participant PX as proxy.ts (middleware)
    participant R as Route Handler
    participant W as withApi
    participant AG as AuthGuard
    participant SF as SupabaseClientFactory
    participant DB as Supabase (Auth + Postgres)
    participant SV as Servis
    participant EH as ApiErrorHandler

    C->>PX: HTTP zahtev (kolačić ili Authorization: Bearer)
    PX->>PX: osveži sesiju u kolačiću (ako postoji)
    PX->>R: prosledi zahtev
    R->>W: handler(request, params)
    W->>AG: createRequestClient(request)
    AG->>SF: readBearerToken(request)<br/>createClientFromBearer(token) ili createServerSupabaseClient()
    SF-->>AG: DbClient (sa identitetom korisnika)
    W->>AG: requireRole(client, options.roles)
    AG->>DB: auth.getUser() + select profiles where id = uid
    alt nema sesije
        AG-->>W: throw AppError(UNAUTHENTICATED)
    else nalog neaktivan
        AG-->>W: throw AppError(ACCOUNT_DISABLED)
    else uloga nije dozvoljena
        AG-->>W: throw AppError(FORBIDDEN)
    else ok
        AG-->>W: AuthContext {userId, role, locale}
        W->>W: Zod parse (params, query, body)
        W->>SV: new Servis(ServiceContext) i poziv metode
        SV-->>W: rezultat
        W-->>C: 200/201 JSON (ili 204 bez tela)
    end
    Note over W,EH: svaka bačena greška ide kroz catch
    W->>EH: toErrorResponse(error, localeFromRequest(request))
    EH-->>C: { error: { code, message, details } } + HTTP status
```

## SD-02 Registracija (UC-01)

```mermaid
sequenceDiagram
    autonumber
    actor G as Gost
    participant P as RegisterPage
    participant AC as ApiClient
    participant R as POST /api/auth/register
    participant AS as AuthService
    participant SA as Supabase Auth
    participant T as triger handle_new_user
    participant DB as profiles

    G->>P: popuni formu i pošalji
    P->>P: Zod validacija (registerSchema) na klijentu
    P->>AC: post("/api/auth/register", data)
    AC->>R: POST JSON
    R->>R: Zod validacija (ista registerSchema)
    R->>AS: register({fullName, email, password}, locale)
    AS->>SA: signUp(email, password, data: {full_name, locale})
    alt email postoji
        SA-->>AS: korisnik bez identiteta (Supabase ne otkriva da nalog postoji)
        AS-->>R: throw AppError(EMAIL_ALREADY_REGISTERED)
        R-->>AC: 409
        AC-->>P: ApiClientError
        P-->>G: prevedena poruka greške
    else uspeh
        SA->>T: INSERT u auth.users
        T->>DB: INSERT profiles (role = customer, full_name)
        SA-->>AS: user (nepotvrđen)
        AS-->>R: ok
        R-->>AC: 201
        P-->>G: "Proverite email"
    end
    G->>R: klik na link iz emaila (GET /api/auth/callback?token_hash=...&type=email)
    Note right of G: completeCallback: verifyOtp(token_hash) daje sesiju<br/>(radi i na drugom uređaju) i preusmerava na /dashboard
```

## SD-03 Prijava Google nalogom i povezivanje naloga (UC-03)

```mermaid
sequenceDiagram
    autonumber
    actor G as Gost
    participant P as LoginPage
    participant RG as GET /api/auth/google
    participant AS as AuthService
    participant SA as Supabase Auth
    participant GO as Google OAuth
    participant RC as GET /api/auth/callback
    participant T as triger handle_new_user

    G->>P: klik "Nastavi sa Google nalogom"
    P->>RG: navigacija
    RG->>AS: getGoogleOAuthUrl(next = /dashboard)
    AS->>SA: signInWithOAuth(provider: google)
    SA-->>AS: URL za Google
    RG-->>G: 302 na Google
    G->>GO: prijava i odobrenje
    GO-->>SA: identitet korisnika
    SA-->>G: 302 na /api/auth/callback?code=...
    G->>RC: GET sa kodom
    RC->>AS: completeCallback(query, uiLocale)
    AS->>SA: exchangeCodeForSession(code)
    alt email već postoji (nalog registrovan emailom)
        SA->>SA: poveži Google identitet sa postojećim korisnikom (automatsko povezivanje po potvrđenom emailu)
        Note over SA: isti user id, isti profil i uloga
    else nov korisnik
        SA->>T: INSERT auth.users
        T->>T: INSERT profiles (role = customer, ime i slika iz Google-a)
    end
    SA-->>AS: sesija
    AS->>AS: loadActiveProfile (nalog mora biti aktivan)
    AS-->>RC: Profile (kolačić sesije postavljen)
    RC-->>G: 302 na /dashboard
```

## SD-04 Kreiranje zahteva (UC-09)

```mermaid
sequenceDiagram
    autonumber
    actor K as Korisnik
    participant F as NewTicketForm
    participant AC as ApiClient
    participant R as POST /api/tickets
    participant TS as TicketService
    participant DB as Supabase Postgres
    participant RT as Supabase Realtime
    participant AG as Agentov browser (useNotifications)

    K->>F: unese podatke i pošalje
    F->>AC: post("/api/tickets", body)
    AC->>R: POST
    R->>R: withApi(roles: customer), Zod createTicketSchema
    R->>TS: create(input)
    TS->>DB: rpc create_ticket(title, description, category_id, priority)
    Note over DB: u jednoj transakciji:<br/>INSERT tickets (status open, created_by = auth.uid())<br/>INSERT ticket_history (created)<br/>INSERT notifications za sve aktivne agente i admine
    DB-->>TS: ticket
    Note over TS: real-time događaj se ne šalje: korisnik nema pravo slanja<br/>na kanal tima, tim saznaje preko obaveštenja
    DB--)RT: INSERT notifications (postgres_changes)
    RT--)AG: novo obaveštenje (samo svoj recipient_id, RLS)
    AG->>AG: povećaj brojač, prikaži toast, osveži listu
    TS-->>R: TicketDetail
    R-->>AC: 201 TicketDetail
    AC-->>F: TicketDetail
    F-->>K: preusmerenje na /tickets/{id}
```

## SD-05 Prikaz detalja zahteva i real-time osvežavanje (UC-11)

```mermaid
sequenceDiagram
    autonumber
    actor P as Korisnik / Agent
    participant PG as tickets/[id]/page.tsx (Server Component)
    participant TS as TicketService
    participant TAP as TicketAccessPolicy
    participant STP as StatusTransitionPolicy
    participant DB as Supabase Postgres (RLS)
    participant CL as LiveRefresh (useTicketRealtime)
    participant RP as RealtimeProvider

    P->>PG: otvori /tickets/{id}
    PG->>TS: getById(id) (direktno na serveru, isti servis kao API)
    TS->>DB: select ticket (RLS), pa kategorija, imena (profile_summaries) i ocena
    alt RLS ne vraća red
        TS-->>PG: throw TICKET_NOT_FOUND
        PG-->>P: not-found.tsx
    else
        TS->>TAP: permissionsFor(ticket, auth, hasRating)
        TAP->>STP: allowedTargets(status, actor)
        TS-->>PG: TicketDetail (sa permissions)
        PG-->>P: HTML (SSR), dugmad samo po permissions
        CL->>RP: subscribe("ticket:{id}", TICKET_UPDATED / TICKET_COMMENT_ADDED / TICKET_ASSIGNED)
        Note over CL,RP: kanal je privatan, Realtime Authorization<br/>dozvoljava samo onima koji vide zahtev
        RP--)CL: događaj {ticketId, actorId}
        CL->>CL: sopstveni događaj (actorId = ja) se preskače
        CL->>PG: router.refresh() (grupisano u 300 ms)
        PG->>TS: getById(id) ponovo (RBAC i RLS važe)
        PG-->>P: ažuriran prikaz bez reload-a
    end
```

Napomena: Server Component sme da pozove servis direktno (čitanje, bez upisa) — pravilo „sve kroz API rute“ važi za **promene podataka**. Isti servis koristi i `GET /api/tickets/{id}`, pa je ponašanje identično i vidljivo u Swaggeru.

## SD-06 Dodavanje komentara (UC-12, UC-18)

```mermaid
sequenceDiagram
    autonumber
    actor A as Agent
    participant CF as CommentForm
    participant R as POST /api/tickets/{id}/comments
    participant CS as CommentService
    participant TAP as TicketAccessPolicy
    participant DB as Supabase Postgres
    participant PB as RealtimePublisher
    participant RT as Supabase Realtime
    participant K as Korisnikov browser

    A->>CF: napiše odgovor (javni ili interni)
    CF->>R: POST {body, isInternal}
    R->>R: withApi(roles: customer, agent, admin), Zod
    R->>CS: add(ticketId, input)
    CS->>DB: select ticket (RLS)
    CS->>TAP: assertCanComment(ticket, auth, isInternal)
    alt korisnik i isInternal
        TAP-->>CS: throw FORBIDDEN_INTERNAL_COMMENT (403)
    else zahtev closed
        TAP-->>CS: throw TICKET_CLOSED (409)
    else dozvoljeno
        CS->>DB: rpc add_comment(ticket_id, body, is_internal)
        Note over DB: transakcija:<br/>INSERT ticket_comments<br/>ako je prvi javni odgovor staff-a: SET first_response_at<br/>ako vlasnik odgovara na waiting_on_customer: status in_progress + istorija<br/>INSERT notifications (javni: drugoj strani, interni: samo staff)
        DB-->>CS: comment
        alt javni komentar
            CS->>PB: publishTicketEvent(TICKET_COMMENT_ADDED) na "ticket:{id}" i "staff"
            PB->>RT: broadcast
            RT--)K: događaj → router.refresh() (novi komentar)
        else interni komentar
            CS->>PB: publishTicketEvent(TICKET_COMMENT_ADDED) samo na "staff"
            Note over RT,K: korisnik ne dobija ni događaj, a RLS mu<br/>ne vraća interne komentare — nema curenja
        end
        CS-->>R: CommentWithAuthor
        R-->>CF: 201
    end
```

## SD-07 Preuzimanje zahteva (UC-16) i dodela (UC-20)

```mermaid
sequenceDiagram
    autonumber
    actor A as Agent / Admin
    participant TA as TicketActions
    participant R as POST /api/tickets/{id}/assign
    participant TS as TicketService
    participant TAP as TicketAccessPolicy
    participant DB as Supabase Postgres
    participant PB as RealtimePublisher

    A->>TA: klik "Preuzmi" (ili admin bira agenta)
    TA->>R: POST {assigneeId}
    R->>R: withApi(roles: agent, admin), Zod
    R->>TS: assign(id, assigneeId)
    TS->>DB: select ticket, select profile(assigneeId)
    TS->>TAP: assertCanAssign(ticket, auth, assigneeId)
    alt agent dodeljuje drugome ili zahtev već ima agenta
        TS-->>R: throw FORBIDDEN / TICKET_ALREADY_ASSIGNED
    else assignee nije staff
        TS-->>R: throw ASSIGNEE_NOT_AGENT
    else ok
        TS->>DB: rpc assign_ticket(ticket_id, assignee_id)
        Note over DB: transakcija:<br/>UPDATE assigned_to<br/>ako open: status in_progress<br/>INSERT history (assigned, status_changed)<br/>INSERT notifications (agent, vlasnik)
        DB-->>TS: ticket
        TS->>PB: publishTicketEvent(TICKET_ASSIGNED) na "ticket:{id}" i "staff"
        TS-->>R: TicketDetail (nove permissions)
        R-->>TA: 200
    end
```

## SD-08 Promena statusa (UC-17, UC-13)

```mermaid
sequenceDiagram
    autonumber
    actor P as Agent / Korisnik / Admin
    participant SS as TicketActions / TicketBoard
    participant R as POST /api/tickets/{id}/status
    participant TS as TicketService
    participant STP as StatusTransitionPolicy
    participant DB as Supabase Postgres
    participant PB as RealtimePublisher
    participant RT as Supabase Realtime
    participant D as Druga strana (browser)

    P->>SS: klik na dugme prelaza ili prevlačenje kartice (ponuđeni su samo dozvoljeni)
    SS->>R: POST {status}
    R->>R: withApi(roles: customer, agent, admin), Zod
    R->>TS: changeStatus(id, to)
    TS->>DB: select ticket (RLS)
    TS->>STP: assertTransition(from, to, {role, isOwner, isAssignee})
    alt nije dozvoljeno
        STP-->>TS: throw INVALID_STATUS_TRANSITION
        TS-->>R: 409
    else agent nije dodeljen
        TS-->>R: throw NOT_ASSIGNED_AGENT (403)
    else ok
        TS->>DB: rpc change_ticket_status(ticket_id, new_status)
        Note over DB: transakcija (funkcija ponovo proverava prelaz):<br/>UPDATE status, resolved_at / closed_at<br/>INSERT history status_changed<br/>INSERT notifications drugoj strani
        DB-->>TS: ticket
        TS->>PB: publishTicketEvent(TICKET_UPDATED) na "ticket:{id}" i "staff"
        PB->>RT: broadcast
        RT--)D: događaj → osveži zahtev
        DB--)RT: INSERT notifications
        RT--)D: obaveštenje status_changed
        TS-->>R: TicketDetail (nove permissions)
        R-->>SS: 200
    end
```

**Dvostruka provera prelaza** (u `StatusTransitionPolicy` i u RPC funkciji) je namerna: TypeScript provera daje jasnu grešku i služi UI-u, a provera u bazi garantuje pravilo i ako neko zaobiđe API.

## SD-09 Ocena zahteva (UC-14)

```mermaid
sequenceDiagram
    autonumber
    actor K as Korisnik
    participant RF as RatingForm
    participant R as POST /api/tickets/{id}/rating
    participant RS as RatingService
    participant TAP as TicketAccessPolicy
    participant DB as Supabase Postgres

    K->>RF: izabere 1-5 zvezdica + komentar
    RF->>R: POST {score, comment}
    R->>R: withApi(roles: customer), Zod (score 1-5)
    R->>RS: rate(ticketId, input)
    RS->>DB: select ticket + postojeća ocena
    RS->>TAP: assertCanRate(ticket, auth, hasRating)
    alt tuđi zahtev (RLS ga ne vraća)
        RS-->>R: TICKET_NOT_FOUND (404)
    else status nije resolved/closed
        RS-->>R: TICKET_NOT_RESOLVED (409)
    else već ocenjeno
        RS-->>R: ALREADY_RATED (409)
    else ok
        RS->>DB: rpc rate_ticket(ticket_id, score, comment)
        Note over DB: INSERT ticket_ratings (UNIQUE ticket_id)<br/>INSERT history rated<br/>INSERT notification agentu
        DB-->>RS: rating
        RS->>RS: publishTicketEvent(TICKET_UPDATED)
        RS-->>R: TicketRating
        R-->>RF: 201
        RF-->>K: "Hvala na oceni"
    end
```

## SD-10 Analitika (UC-23)

Stranica čita podatke na serveru preko istog servisa kao API rute (kao i ostale stranice), pa nema praznog ekrana dok se grafikoni učitavaju. Rute `/api/analytics/*` ostaju za Swagger i Postman i vraćaju iste podatke.

```mermaid
sequenceDiagram
    autonumber
    actor AD as Admin
    participant AF as AnalyticsFilters
    participant AP as analytics/page.tsx
    participant AS as AnalyticsService
    participant DB as Supabase Postgres
    participant CH as Grafikoni (Recharts)

    AD->>AP: otvori /analytics (bez ?from&to)
    AP->>AP: requireCurrentUser, layout: uloga admin
    AP->>AP: Zod (dateRangeQuerySchema), podrazumevano poslednjih 30 dana
    par paralelni upiti
        AP->>AS: overview(range)
        AS->>DB: rpc analytics_overview(from, to)
    and
        AP->>AS: trend(range, day|week)
        AS->>DB: rpc analytics_trend(...)
    and
        AP->>AS: agents(range)
        AS->>DB: rpc analytics_agents(...)
    and
        AP->>AS: byDimension(range, status | category | priority)
        AS->>DB: rpc analytics_by_dimension(...)
    end
    Note over DB: svaka funkcija proverava ulogu admin (FORBIDDEN) i period
    AS-->>AP: KPI, tačke trenda, učinak, raspodela (dopunjeno nulama)
    AP-->>CH: podaci kao props
    CH-->>AD: KpiCards, trend, raspodela, CSAT, tabela agenata
    AD->>AF: izaberi „180 d“ ili svoj period
    AF->>AF: provera perioda (rangeError), greška ispod polja
    AF->>AP: router.push(/analytics?from=...&to=...)
    Note over AP: ponovi upite za novi period
```

## SD-11 Promena jezika (UC-07)

```mermaid
sequenceDiagram
    autonumber
    actor P as Korisnik
    participant LS as LanguageSwitcher
    participant AC as ApiClient
    participant R as PATCH /api/me
    participant PS as ProfileService
    participant NI as next-intl

    P->>LS: klik EN / SR
    LS->>LS: postavi kolačić NEXT_LOCALE
    opt korisnik je prijavljen
        LS->>AC: patch("/api/me", {locale})
        AC->>R: PATCH
        R->>PS: updateMe({locale})
        PS-->>R: profil
    end
    LS->>NI: router.refresh()
    NI-->>P: ceo interfejs na izabranom jeziku (i poruke grešaka)
```

## SD-12 Zamena real-time provajdera (arhitektonski scenario)

Pokazuje zašto je real-time sloj zamenljiv: komponente se ne menjaju, menja se samo env promenljiva i implementacija.

```mermaid
sequenceDiagram
    autonumber
    participant H as useTicketRealtime (hook)
    participant F as getRealtimeProvider()
    participant SP as SupabaseRealtimeProvider
    participant WP as WebSocketRealtimeProvider (rezerva)
    participant SR as Supabase Realtime
    participant WS as Sopstveni WS server (Render/Railway)

    H->>F: getRealtimeProvider()
    alt NEXT_PUBLIC_REALTIME_PROVIDER = supabase
        F-->>H: SupabaseRealtimeProvider
        H->>SP: subscribe("ticket:42", TICKET_UPDATED, handler)
        SP->>SR: channel.on("broadcast") .subscribe()
        SR--)SP: događaj
        SP--)H: handler(payload)
    else NEXT_PUBLIC_REALTIME_PROVIDER = websocket
        F-->>H: WebSocketRealtimeProvider
        H->>WP: subscribe("ticket:42", TICKET_UPDATED, handler)
        WP->>WS: {"type":"subscribe","channel":"ticket:42","token":JWT}
        WS--)WP: događaj
        WP--)H: handler(payload)
    end
```

## SD-13 Zvonce: novo obaveštenje u realnom vremenu (UC-08, FZ-12, FZ-13)

Agent menja status Aninog zahteva; Anino zvonce i otvorena stranica se ažuriraju bez reload-a. Poruka kroz WebSocket nosi samo ID-jeve; tekst se sastavlja iz prevoda posle učitavanja kroz API.

```mermaid
sequenceDiagram
    autonumber
    actor AG as Agent
    participant API as POST /api/tickets/{id}/status
    participant DB as Supabase Postgres (RPC + RLS)
    participant RT as Supabase Realtime (WebSocket)
    participant NB as NotificationBell (useNotifications)
    participant NAPI as GET /api/notifications
    actor K as Korisnik (Ana)

    AG->>API: { status: "waiting_on_customer" }
    API->>DB: rpc change_ticket_status
    Note over DB: transakcija: UPDATE tickets, INSERT ticket_history,<br/>INSERT notifications (primalac Ana)
    DB-->>API: zahtev
    API->>RT: publish("ticket:{id}", TICKET_UPDATED, { ticketId, actorId })
    DB--)RT: INSERT notifications (postgres_changes, RLS: samo primalac)
    RT--)NB: NOTIFICATION_CREATED { ticketId, actorId }
    NB->>NAPI: get("/notifications", {pageSize})
    NAPI-->>NB: { items, unreadCount }
    NB-->>K: brojač na zvoncetu + toast „Zahtev #1003: promenjen status (Jelena Agentić)“
    NB->>NB: router.refresh() (panel, lista, zahtev)
```

## SD-14 Kanban tabla: prevlačenje kartice (UC-16, UC-17)

Tabla (`/tickets?view=board`) ne uvodi nova pravila: dozvoljene kolone računa `boardDropTargets` nad istom `StatusTransitionPolicy`, a spuštanje kartice poziva iste API rute kao dugmad na stranici zahteva. Kartica se premesti odmah (optimistički prikaz) i vraća se ako API odbije.

```mermaid
sequenceDiagram
    autonumber
    actor A as Agent
    participant TB as TicketBoard (@dnd-kit)
    participant BR as board-rules.ts
    participant AC as ApiClient (useApiAction)
    participant R as POST /api/tickets/{id}/status ili /assign
    participant TS as TicketService
    participant PG as tickets/page.tsx (Server Component)

    A->>TB: podigne karticu (miš, dugi pritisak ili Space)
    TB->>BR: boardDropTargets(ticket, user)
    BR-->>TB: dozvoljene kolone i akcija (status ili claim)
    TB-->>A: dozvoljene kolone istaknute, najava za čitač ekrana
    A->>TB: spusti karticu u kolonu „U obradi“
    TB->>BR: applyBoardMoves(kolone, privremeno premeštanje)
    TB-->>A: kartica odmah u novoj koloni
    alt akcija claim (nedodeljen otvoren zahtev)
        TB->>AC: post("/tickets/{id}/assign", {assigneeId: ja})
        AC->>R: POST /assign
        R->>TS: assign(id, userId)
    else akcija status
        TB->>AC: post("/tickets/{id}/status", {status})
        AC->>R: POST /status
        R->>TS: changeStatus(id, to)
    end
    alt API odbije (npr. INVALID_STATUS_TRANSITION, TICKET_ALREADY_ASSIGNED)
        R-->>AC: 4xx { error: { code } }
        AC-->>TB: ApiClientError
        TB-->>A: kartica se vraća, prevedena poruka greške
    else uspeh
        R-->>AC: 200 TicketDetail
        AC->>PG: router.refresh()
        PG->>TS: list(query) za svih pet kolona (paralelno)
        PG-->>TB: nove kolone sa servera (brišu privremena premeštanja)
    end
```
