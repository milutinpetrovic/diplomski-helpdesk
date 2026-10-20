# Tehnička podrška — veb aplikacija (diplomski rad)

Veb aplikacija za prijavu, praćenje i rešavanje zahteva za tehničku podršku, napravljena u Next.js-u.
Diplomski rad: Milutin Petrović (3407), Fakultet informacionih tehnologija, Univerzitet Metropolitan Beograd.
Mentor: dr Nemanja Zdravković.

- Kontekst i pravila za razvoj: [`CLAUDE.md`](CLAUDE.md)
- Projektni dizajn (use case, baza, klase, dijagrami sekvenci, API, plan po fazama): [`docs/`](docs/README.md)

## Tehnologije

Next.js 16 (App Router), React 19, TypeScript 5.9 (strict), Tailwind CSS 4, shadcn/ui, next-intl (srpski i engleski).
U narednim fazama: Supabase (baza, autentifikacija, real-time), Zod, Swagger/OpenAPI, Recharts, Vitest, Playwright.

## Pokretanje

Potrebno: Node.js 22 i pnpm.

```bash
pnpm install
pnpm dev          # razvojni server na http://localhost:3000
```

## Komande

| Komanda                             | Šta radi                                    |
| ----------------------------------- | ------------------------------------------- |
| `pnpm dev`                          | pokreće aplikaciju u razvojnom režimu       |
| `pnpm build`                        | pravi produkcioni build                     |
| `pnpm start`                        | pokreće produkcioni build                   |
| `pnpm lint`                         | ESLint provera                              |
| `pnpm typecheck`                    | generiše tipove ruta i proverava TypeScript |
| `pnpm format` / `pnpm format:check` | formatira kod / proverava format (Prettier) |

## Promenljive okruženja

Kopirati `.env.example` u `.env.local` i popuniti vrednosti (potrebno od Faze 2).

## Stanje razvoja

| Faza | Sadržaj                                          | Stanje      |
| ---- | ------------------------------------------------ | ----------- |
| 1    | Kostur aplikacije, prevodi, početna stranica, CI | u pregledu  |
| 2    | Baza podataka (Supabase)                         | nije počelo |
| 3–10 | vidi `docs/07-uputstvo-za-implementaciju.md`     | nije počelo |
