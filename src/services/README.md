# src/services — servisni sloj (poslovna logika)

Ovde su klase servisa (TicketService, CommentService, ...) i politike (`policies/`). Servisi ne znaju za HTTP; dobijaju `ServiceContext` kroz konstruktor i bacaju `AppError`.
Opis klasa: `docs/03-dijagram-klasa.md`, sekcija 3. Počinje se u Fazi 5 (`docs/07-uputstvo-za-implementaciju.md`).
