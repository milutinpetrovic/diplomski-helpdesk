# src/services — servisni sloj (poslovna logika)

Ovde su klase servisa (TicketService, CommentService, ...) i politike (`policies/`). Servisi ne znaju za HTTP; dobijaju `ServiceContext` kroz konstruktor i bacaju `AppError`.
Opis klasa: `docs/03-dijagram-klasa.md`, sekcija 3. Faza 4: `auth/` (AuthService) i `profile/` (ProfileService). Faza 5a: `policies/` (StatusTransitionPolicy, TicketAccessPolicy), `tickets/` (TicketService, pretraga), `comments/`, `ratings/`, `categories/`, `admin/` (za sada samo spisak agenata) i `shared/` (učitavanje imena i kategorija, slanje real-time događaja). Faza 6: `dashboard/`. Faza 7: `notifications/`. Faza 8: `analytics/` (AnalyticsService i čiste funkcije za pretvaranje redova). Ostali servisi u kasnijim fazama (`docs/07-uputstvo-za-implementaciju.md`).
