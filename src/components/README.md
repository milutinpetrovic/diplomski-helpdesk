# src/components — React komponente

- `ui/` — komponente biblioteke shadcn/ui (kopiran izvorni kod). Zadržavaju nazive biblioteke (mala slova, npr. `button.tsx`) da bi se mogle ažurirati komandom `pnpm dlx shadcn add <naziv>`.
- `layout/` i ostali domenski folderi (`tickets/`, `comments/`, `dashboard/`, ...) — naše komponente, nazivi u `PascalCase.tsx`.

Spisak planiranih komponenti: `docs/03-dijagram-klasa.md`, sekcija 5.

## tickets/ (Faza 5b)

- `TicketList` (tabela na računaru, kartice na telefonu), `TicketFilters` (filteri u adresi), `TicketPagination`
- `NewTicketForm`, `TicketActions` (dugmad po `permissions`), `TicketComments` + `CommentForm`, `TicketHistory`, `RatingForm` + `RatingStars`, `TicketBadges`
- `ticket-labels.ts` (boje, nazivi dugmadi prelaza, sortiranja) i `list-params.ts` (adresa <-> filteri) su čiste funkcije pokrivene testom `tests/unit/ticket-ui.test.ts`.

## analytics/ (Faza 8)

- `AnalyticsFilters` (period u adresi: brzi izbori i svoj period), `KpiCards`, `TicketsTrendChart`, `ByDimensionChart`, `CsatChart`, `AgentsTable` (sortiranje klikom na kolonu)
- Grafikoni su Recharts (klijentske komponente); ispod svakog je `ChartDataTable` — isti podaci kao tabela (pristupačnost).
- `analytics-format.ts` (trajanje, ocena, naziv grupe) i `sortAgents` su pokriveni testom `tests/unit/analytics.test.ts`.
