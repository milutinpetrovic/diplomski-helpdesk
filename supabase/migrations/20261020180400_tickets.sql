-- =============================================================================
-- Migracija 5: zahtevi (tickets)
--
-- Šta je ovde:
--   - tabela `tickets` sa indeksima i kolonom za pretragu teksta
--   - RLS: vlasnik vidi svoje zahteve, agent i admin vide sve
--   - can_view_ticket(): da li prijavljeni korisnik sme da vidi zahtev
--     (koriste je RPC funkcije i real-time dozvole)
--
-- Direktan INSERT/UPDATE/DELETE nije dozvoljen nikome: zahtevi se kreiraju
-- i menjaju isključivo kroz RPC funkcije (migracija 8), koje proveravaju
-- pravila i u istoj transakciji upisuju istoriju i obaveštenja.
-- Dokumentacija: docs/02-baza-podataka.md, sekcije 3.3 i 8.
-- =============================================================================

-- Tabela tickets: jedan zahtev za podršku.
--   number        - čitljiv broj za prikaz (#1042), dodeljuje ga baza
--   assigned_to   - agent/admin koji rešava (null = nedodeljen)
--   first_response_at - prvi javni odgovor agenta/admina (za analitiku)
--   resolved_at / closed_at - vreme prelaska u resolved / closed
--   search_vector - automatski izračunat tekst za pretragu (naslov + opis)
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  title text not null check (char_length(title) between 5 and 150),
  description text not null check (char_length(description) between 10 and 5000),
  status public.ticket_status not null default 'open',
  priority public.ticket_priority not null default 'medium',
  category_id uuid not null references public.categories (id),
  created_by uuid not null references public.profiles (id),
  assigned_to uuid references public.profiles (id) on delete set null,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('simple', title || ' ' || description)
  ) stored
);

comment on table public.tickets is
  'Zahtevi za podršku. Menjaju se samo kroz RPC funkcije (create_ticket, update_ticket, assign_ticket, change_ticket_status...).';

-- Indeksi za najčešće filtere na listi zahteva i dashboard-u.
create index tickets_created_by_idx on public.tickets (created_by);
create index tickets_assigned_to_idx on public.tickets (assigned_to);
create index tickets_status_idx on public.tickets (status);
create index tickets_category_id_idx on public.tickets (category_id);
create index tickets_created_at_idx on public.tickets (created_at desc);
-- GIN indeks za brzu pretragu teksta (parametar `q` na GET /api/tickets).
create index tickets_search_vector_idx on public.tickets using gin (search_vector);

-- Triger: osvežava tickets.updated_at pri svakoj izmeni.
create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function private.set_updated_at();

-- Uključujemo RLS.
alter table public.tickets enable row level security;

-- Prava: prijavljen samo čita (filtrira politika ispod). Sve izmene idu
-- kroz RPC funkcije koje se izvršavaju kao vlasnik baze.
revoke all on table public.tickets from anon, authenticated;
grant select on table public.tickets to authenticated;

-- Politika: korisnik vidi svoje zahteve; agent i admin vide sve.
create policy tickets_select_own_or_staff
  on public.tickets
  for select
  to authenticated
  using (
    (created_by = auth.uid() and public.current_user_role() is not null)
    or public.is_staff()
  );

-- Funkcija can_view_ticket: da li prijavljeni (aktivan) korisnik sme da vidi
-- zahtev. Isto pravilo kao politika iznad, ali kao funkcija koju mogu da
-- pozovu RPC funkcije i real-time dozvole (migracija 9).
-- Za nepostojeći zahtev vraća false (ne otkriva da li zahtev postoji).
create function public.can_view_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        (t.created_by = auth.uid() and public.current_user_role() is not null)
        or public.is_staff()
      )
  );
$$;

revoke execute on function public.can_view_ticket(uuid) from public, anon;
grant execute on function public.can_view_ticket(uuid) to authenticated;
