# postman — Postman kolekcija za API

Kolekcija poziva sve API rute aplikacije, redom, kao prave uloge (korisnik, agent, admin) i za svaki poziv proverava status, oblik odgovora i kod greške. Izveštaj o testovima je u [`docs/08-testiranje.md`](../docs/08-testiranje.md), sekcija 6.

| Fajl                               | Šta je                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `helpdesk.postman_collection.json` | kolekcija (57 poziva u 8 foldera); **generisana, ne menjati ručno**        |
| `local.postman_environment.json`   | okruženje `local`: `baseUrl` = http://localhost:3000                       |
| `demo.postman_environment.json`    | okruženje `demo`: `baseUrl` = adresa demo servera (upisati posle deploy-a) |

## Pokretanje u Postman aplikaciji

1. Pokrenuti aplikaciju lokalno: `pnpm db:start`, pa `pnpm dev` (ili `pnpm build` i `pnpm start`).
2. U Postman-u: **Import** → izabrati sva tri JSON fajla iz ovog foldera.
3. Gore desno izabrati okruženje **Tehnička podrška — local**.
4. Na kolekciji **Tehnička podrška — API** kliknuti **Run** (Run collection), ostaviti redosled kakav jeste i pokrenuti.
5. Runner prikazuje svaki poziv i njegove testove (zeleno = prošao). Pojedinačan poziv se može otvoriti i poslati ručno; rezultat testova je na kartici **Test Results**.

Prvi folder se prijavljuje kao korisnik (Ana), agent (Jelena) i admin i čuva njihove tokene u promenljivama kolekcije. Zato se pojedinačni pozivi iz kasnijih foldera mogu slati tek posle tih prijava. Svaki poziv ima opis iz Swagger-a (kartica **Docs**).

## Pokretanje iz komandne linije (newman)

```bash
pnpm test:api      # cela kolekcija nad http://localhost:3000 (aplikacija mora da radi)
```

Isto radi CI (posao `api`), dva puta zaredom nad istom bazom.

## Kad se doda ili promeni API ruta

Kolekcija se pravi iz OpenAPI specifikacije, iste one koju prikazuje Swagger (`/api-docs`):

1. Opisati rutu u `src/lib/openapi/routes/` (kao i do sada).
2. Dodati poziv u `SCENARIO` u `scripts/postman-generate.mts` (uloga, telo, očekivani status i kod greške).
3. Dok aplikacija radi: `pnpm postman:generate` i sačuvati izmenjen JSON.

Ako ruta postoji u Swagger-u a nema poziv u scenariju, skripta javlja grešku. Tako Swagger i Postman uvek opisuju isti API. CI proverava da je sačuvana kolekcija ažurna (`pnpm postman:generate --check`).

**Napomena:** svako pokretanje pravi nov zahtev, nov nalog i novu (pa deaktiviranu) kategoriju. Kolekcija je za lokalno i demo okruženje, ne za produkciju.
