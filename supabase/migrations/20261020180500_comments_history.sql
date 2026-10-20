-- =============================================================================
-- Migracija 6: komentari i istorija zahteva
--
-- Šta je ovde:
--   - tabela `ticket_comments` (javni i interni komentari) + RLS
--   - tabela `ticket_history` (audit log svih promena) + RLS
--
-- Upis u obe tabele radi isključivo RPC funkcija (add_comment, kao i ostale
-- funkcije za istoriju), pa korisnici imaju samo pravo čitanja.
-- Dokumentacija: docs/02-baza-podataka.md, sekcije 3.4, 3.5 i 8.
-- =============================================================================

-- Tabela ticket_comments: razgovor na zahtevu.
-- is_internal = true znači interna beleška tima podrške; korisnik je nikad
-- ne vidi (ni kroz API, ni kroz bazu, ni kroz real-time).
create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 5000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ticket_comments is
  'Komentari na zahtevu. Interne (is_internal) vide samo agent i admin. Upis samo kroz add_comment.';

-- Indeks: komentari jednog zahteva hronološki (stranica detalja zahteva).
create index ticket_comments_ticket_id_created_at_idx
  on public.ticket_comments (ticket_id, created_at);

-- Triger: osvežava ticket_comments.updated_at pri izmeni.
create trigger ticket_comments_set_updated_at
  before update on public.ticket_comments
  for each row execute function private.set_updated_at();

-- Uključujemo RLS i ostavljamo samo pravo čitanja.
alter table public.ticket_comments enable row level security;
revoke all on table public.ticket_comments from anon, authenticated;
grant select on table public.ticket_comments to authenticated;

-- Politika: agent i admin vide sve komentare; vlasnik zahteva vidi samo
-- javne komentare svog zahteva.
create policy ticket_comments_select
  on public.ticket_comments
  for select
  to authenticated
  using (
    public.is_staff()
    or (
      not is_internal
      and public.current_user_role() is not null
      and exists (
        select 1
        from public.tickets t
        where t.id = ticket_id
          and t.created_by = auth.uid()
      )
    )
  );

-- Tabela ticket_history: nepromenljiv zapis svake promene na zahtevu
-- (kreiranje, status, dodela, prioritet, kategorija, izmena teksta, ocena).
-- actor_id = null znači da je promenu izvršio sistem (npr. automatski
-- prelaz waiting_on_customer -> in_progress kad korisnik odgovori).
-- old_value / new_value su mali JSON objekti, npr. {"status":"open"}.
create table public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action public.history_action not null,
  old_value jsonb,
  new_value jsonb,
  -- clock_timestamp() (a ne now()) da bi stavke upisane u istoj transakciji
  -- imale različito vreme i ispravan redosled na vremenskoj liniji.
  created_at timestamptz not null default clock_timestamp()
);

comment on table public.ticket_history is
  'Istorija promena zahteva (audit log). Samo upis kroz RPC funkcije i čitanje; nikad izmena ni brisanje.';

-- Indeks: istorija jednog zahteva hronološki.
create index ticket_history_ticket_id_created_at_idx
  on public.ticket_history (ticket_id, created_at);

-- Uključujemo RLS i ostavljamo samo pravo čitanja.
alter table public.ticket_history enable row level security;
revoke all on table public.ticket_history from anon, authenticated;
grant select on table public.ticket_history to authenticated;

-- Politika: istoriju zahteva vidi onaj ko sme da vidi i sam zahtev
-- (vlasnik ili agent/admin). Istorija ne sadrži tekst komentara, pa nema
-- curenja internih beleški.
create policy ticket_history_select
  on public.ticket_history
  for select
  to authenticated
  using (public.can_view_ticket(ticket_id));
