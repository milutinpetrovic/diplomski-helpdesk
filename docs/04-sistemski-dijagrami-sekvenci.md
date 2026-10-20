# 04 — Sistemski dijagrami sekvenci (SSD)

Sistemski dijagram sekvenci prikazuje sistem kao **crnu kutiju**: samo akter, sistemske operacije koje akter poziva i odgovore sistema. Unutrašnja struktura (API, servisi, baza) prikazana je tek u `05-dijagrami-sekvenci.md`.

Svaka sistemska operacija ovde odgovara jednoj API ruti (u zagradi). Ugovori operacija (preduslovi i postuslovi) su na kraju dokumenta.

## SSD-01 Registracija (UC-01)

```mermaid
sequenceDiagram
    actor G as Gost
    participant S as :Sistem

    G->>S: register(fullName, email, password)<br/>[POST /api/auth/register]
    alt podaci neispravni ili email zauzet
        S-->>G: greška (VALIDATION_ERROR / EMAIL_ALREADY_REGISTERED)
    else uspeh
        S-->>G: poruka "Proverite email"
        G->>S: confirmEmail(token)<br/>[GET /api/auth/callback]
        S-->>G: sesija + preusmerenje na /dashboard
    end
```

## SSD-02 Prijava email + lozinka (UC-02)

```mermaid
sequenceDiagram
    actor G as Gost
    participant S as :Sistem

    G->>S: login(email, password)<br/>[POST /api/auth/login]
    alt pogrešni podaci
        S-->>G: greška INVALID_CREDENTIALS
    else email nije potvrđen
        S-->>G: greška EMAIL_NOT_CONFIRMED
    else nalog deaktiviran
        S-->>G: greška ACCOUNT_DISABLED
    else uspeh
        S-->>G: sesija (kolačić) + profil (uloga, jezik)
    end
```

## SSD-03 Prijava Google nalogom (UC-03)

```mermaid
sequenceDiagram
    actor G as Gost
    participant S as :Sistem
    participant GO as Google (spoljni sistem)

    G->>S: startGoogleLogin()<br/>[GET /api/auth/google]
    S-->>G: preusmerenje na Google
    G->>GO: prijava i odobrenje
    GO-->>G: preusmerenje sa kodom
    G->>S: oauthCallback(code)<br/>[GET /api/auth/callback]
    S-->>G: sesija + preusmerenje na /dashboard
```

## SSD-04 Kreiranje zahteva (UC-09)

```mermaid
sequenceDiagram
    actor K as Korisnik
    participant S as :Sistem
    actor A as Agenti (prijavljeni)

    K->>S: getCategories()<br/>[GET /api/categories]
    S-->>K: lista aktivnih kategorija
    K->>S: createTicket(title, description, categoryId, priority)<br/>[POST /api/tickets]
    alt neispravni podaci
        S-->>K: greška VALIDATION_ERROR (po poljima)
    else uspeh
        S-->>K: kreiran zahtev (id, number, status = open)
        S--)A: obaveštenje ticket_created (real-time)
    end
```

## SSD-05 Pregled i pretraga zahteva (UC-10, UC-15, UC-19)

```mermaid
sequenceDiagram
    actor P as Prijavljeni korisnik
    participant S as :Sistem

    P->>S: listTickets(filters, page)<br/>[GET /api/tickets]
    S-->>P: stranica zahteva (samo vidljivi za ulogu) + ukupan broj
    P->>S: getTicket(id)<br/>[GET /api/tickets/{id}]
    alt nema pristup ili ne postoji
        S-->>P: greška TICKET_NOT_FOUND
    else
        S-->>P: zahtev + dozvoljene akcije (allowedTransitions, canComment, canRate)
        P->>S: getComments(id)<br/>[GET /api/tickets/{id}/comments]
        S-->>P: komentari (interni samo za agenta/admina)
        P->>S: getHistory(id)<br/>[GET /api/tickets/{id}/history]
        S-->>P: istorija promena
    end
```

## SSD-06 Dodavanje komentara (UC-12, UC-18)

```mermaid
sequenceDiagram
    actor P as Korisnik / Agent
    participant S as :Sistem
    actor D as Druga strana

    P->>S: addComment(ticketId, body, isInternal)<br/>[POST /api/tickets/{id}/comments]
    alt korisnik šalje interni komentar
        S-->>P: greška FORBIDDEN_INTERNAL_COMMENT
    else zahtev zatvoren
        S-->>P: greška TICKET_CLOSED
    else uspeh
        S-->>P: sačuvan komentar
        S--)D: obaveštenje comment_added (real-time)
    end
```

## SSD-07 Preuzimanje i dodela zahteva (UC-16, UC-20)

```mermaid
sequenceDiagram
    actor A as Agent / Admin
    participant S as :Sistem
    actor K as Vlasnik zahteva

    opt admin bira agenta
        A->>S: listAgents()<br/>[GET /api/agents]
        S-->>A: lista agenata
    end
    A->>S: assignTicket(ticketId, assigneeId)<br/>[POST /api/tickets/{id}/assign]
    alt već dodeljen drugom (agent)
        S-->>A: greška TICKET_ALREADY_ASSIGNED
    else izabrani nije agent
        S-->>A: greška ASSIGNEE_NOT_AGENT
    else uspeh
        S-->>A: ažuriran zahtev (assignedTo, status = in_progress)
        S--)K: obaveštenje ticket_assigned
    end
```

## SSD-08 Promena statusa (UC-13, UC-17)

```mermaid
sequenceDiagram
    actor P as Agent / Admin / Korisnik
    participant S as :Sistem
    actor D as Druga strana

    P->>S: changeStatus(ticketId, newStatus)<br/>[POST /api/tickets/{id}/status]
    alt prelaz nije dozvoljen za ulogu
        S-->>P: greška INVALID_STATUS_TRANSITION
    else agent nije dodeljen
        S-->>P: greška NOT_ASSIGNED_AGENT
    else uspeh
        S-->>P: ažuriran zahtev + nove dozvoljene akcije
        S--)D: obaveštenje status_changed
    end
```

## SSD-09 Ocena rešenog zahteva (UC-14)

```mermaid
sequenceDiagram
    actor K as Korisnik
    participant S as :Sistem
    actor A as Dodeljeni agent

    K->>S: rateTicket(ticketId, score, comment)<br/>[POST /api/tickets/{id}/rating]
    alt već ocenjen
        S-->>K: greška ALREADY_RATED
    else nije rešen
        S-->>K: greška TICKET_NOT_RESOLVED
    else uspeh
        S-->>K: sačuvana ocena
        S--)A: obaveštenje ticket_rated
    end
```

## SSD-10 Obaveštenja (UC-08)

```mermaid
sequenceDiagram
    actor P as Prijavljeni korisnik
    participant S as :Sistem

    P->>S: subscribeNotifications()<br/>[real-time pretplata]
    P->>S: listNotifications(page)<br/>[GET /api/notifications]
    S-->>P: lista + broj nepročitanih
    S--)P: novo obaveštenje (real-time događaj)
    P->>S: markRead(id)<br/>[POST /api/notifications/{id}/read]
    S-->>P: OK
    P->>S: markAllRead()<br/>[POST /api/notifications/read-all]
    S-->>P: OK
```

## SSD-11 Upravljanje korisnicima (UC-21)

```mermaid
sequenceDiagram
    actor AD as Admin
    participant S as :Sistem

    AD->>S: listUsers(q, role, page)<br/>[GET /api/admin/users]
    S-->>AD: stranica korisnika
    AD->>S: updateUser(userId, role?, isActive?)<br/>[PATCH /api/admin/users/{id}]
    alt menja sebe
        S-->>AD: greška CANNOT_MODIFY_SELF
    else uspeh
        S-->>AD: ažuriran profil
    end
```

## SSD-12 Analitika (UC-23)

```mermaid
sequenceDiagram
    actor AD as Admin
    participant S as :Sistem

    AD->>S: getOverview(from, to)<br/>[GET /api/analytics/overview]
    S-->>AD: KPI vrednosti
    AD->>S: getByDimension(from, to, dimension)<br/>[GET /api/analytics/by-dimension]
    S-->>AD: brojevi po statusu / kategoriji / prioritetu
    AD->>S: getAgents(from, to)<br/>[GET /api/analytics/agents]
    S-->>AD: učinak po agentu
    AD->>S: getTrend(from, to, bucket)<br/>[GET /api/analytics/trend]
    S-->>AD: kreirani i rešeni kroz vreme
```

## Ugovori sistemskih operacija

| Operacija          | Preduslovi                                                                | Postuslovi                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `register`         | Gost nije prijavljen; email ne postoji                                    | Kreiran `auth.users` red i `profiles` sa ulogom `customer`; poslat email za potvrdu                                           |
| `login`            | Nalog postoji, potvrđen, aktivan                                          | Postavljen kolačić sesije                                                                                                     |
| `oauthCallback`    | Validan kod od Google-a                                                   | Sesija postavljena; profil postoji (kreiran ili povezan)                                                                      |
| `createTicket`     | Prijavljen `customer`, potvrđen email; kategorija aktivna                 | Kreiran `tickets` red (`open`); `ticket_history` `created`; `notifications` za sve agente/admine                              |
| `addComment`       | Akter vidi zahtev; zahtev nije `closed`; korisnik samo javni              | Kreiran `ticket_comments`; eventualno `first_response_at`; eventualno status `waiting_on_customer → in_progress`; obaveštenja |
| `assignTicket`     | Akter `agent` (sebi, nedodeljen) ili `admin`; `assigneeId` je agent/admin | `assigned_to` postavljen; status `open → in_progress`; istorija; obaveštenja vlasniku i agentu                                |
| `changeStatus`     | Prelaz dozvoljen po tabeli prelaza za ulogu akteru                        | Novi status; `resolved_at`/`closed_at` ažurirani; istorija; obaveštenje                                                       |
| `rateTicket`       | Akter je vlasnik; status `resolved`/`closed`; nema ocene                  | Kreiran `ticket_ratings`; istorija `rated`; obaveštenje agentu                                                                |
| `markRead`         | Obaveštenje pripada akteru                                                | `is_read = true`                                                                                                              |
| `updateUser`       | Akter `admin`; ne menja sebe                                              | `role`/`is_active` ažurirani; pri oduzimanju uloge agentu njegovi otvoreni zahtevi postaju nedodeljeni                        |
| `getOverview` itd. | Akter `admin`; period ≤ 1 godina                                          | Nema promene stanja                                                                                                           |
