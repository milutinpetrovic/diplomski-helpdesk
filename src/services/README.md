# src/services — servisni sloj (poslovna logika)

Ovde su klase servisa (TicketService, CommentService, ...) i politike (`policies/`). Servisi ne znaju za HTTP; dobijaju `ServiceContext` kroz konstruktor i bacaju `AppError`.
Opis klasa: `docs/03-dijagram-klasa.md`, sekcija 3. Faza 4: `auth/` (AuthService) i `profile/` (ProfileService); ostali servisi od Faze 5 (`docs/07-uputstvo-za-implementaciju.md`).
