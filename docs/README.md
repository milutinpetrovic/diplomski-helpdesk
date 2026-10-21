# Projektna dokumentacija

Projektni dizajn aplikacije za tehničku podršku (diplomski rad, Milutin Petrović 3407). Dijagrami su u Mermaid formatu i prikazuju se direktno na GitHub-u; za rad se izvoze u PNG/SVG (`npx @mermaid-js/mermaid-cli -i fajl.mmd -o fajl.png`).

| #   | Dokument                                                           | Sadržaj                                                                                                              |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 01  | [Slučajevi korišćenja](01-slucajevi-koriscenja.md)                 | Akteri, use case dijagrami, spisak UC-01..UC-25, specifikacije ključnih slučajeva                                    |
| 02  | [Baza podataka](02-baza-podataka.md)                               | ER dijagram, enum tipovi, tabele, tok statusa i tabela prelaza, trigeri, RPC, RLS matrica, demo podaci               |
| 03  | [Dijagram klasa](03-dijagram-klasa.md)                             | Slojevi, domenski model, servisi, politike, infrastruktura (real-time, greške, auth, OpenAPI), hook-ovi i komponente |
| 04  | [Sistemski dijagrami sekvenci](04-sistemski-dijagrami-sekvenci.md) | SSD-01..12 i ugovori sistemskih operacija                                                                            |
| 05  | [Dijagrami sekvenci](05-dijagrami-sekvenci.md)                     | SD-01..12: detaljna saradnja objekata za ključne tokove                                                              |
| 06  | [API i stranice](06-api-i-stranice.md)                             | Sve API rute, greške, Zod šeme, stranice, meni po ulozi                                                              |
| 07  | [Uputstvo za implementaciju](07-uputstvo-za-implementaciju.md)     | Faze 0–10 sa zadacima i kriterijumima završetka, pravila, prevodi, mapa dokument → poglavlje rada                    |
| 08  | [Testiranje](08-testiranje.md)                                     | Vrste testova, pokretanje, RLS matrica sa testom za svaku ćeliju, pokrivenost koda                                   |

Pravila za održavanje: kada se u kodu promeni tabela, ruta, klasa ili tok, u istom commit-u se ažurira odgovarajući dokument ovde. Dokumentacija i kod ne smeju da se razilaze.

Pretpostavke koje čekaju potvrdu (označene u dokumentima):

- Korisnik sme da otkaže svoj otvoren zahtev, potvrdi rešenje i ponovo otvori rešen zahtev (`02`, sekcija 4).
- Sve promene podataka idu kroz API rute, bez Server Actions.
- Swagger UI u produkciji: prikazan ili sakriven.
