-- =============================================================================
-- Migracija 4: kategorije zahteva
--
-- Šta je ovde: tabela `categories` (nazivi na oba jezika) i RLS.
-- Kategorije uređuje admin direktno (bez RPC funkcije) jer nema
-- dodatnih poslovnih pravila: samo provera uloge kroz RLS.
-- Dokumentacija: docs/02-baza-podataka.md, sekcija 3.2.
-- =============================================================================

-- Tabela categories: oblasti problema (tehnički problem, nalog, naplata...).
-- Kategorija se ne briše nego deaktivira (is_active = false), da stari
-- zahtevi zadrže svoju kategoriju.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null check (char_length(name_en) between 2 and 60),
  name_sr text not null check (char_length(name_sr) between 2 and 60),
  description_en text check (char_length(description_en) <= 300),
  description_sr text check (char_length(description_sr) <= 300),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.categories is
  'Kategorije zahteva (sr + en nazivi). Ne brišu se, nego deaktiviraju.';

-- Uključujemo RLS.
alter table public.categories enable row level security;

-- Prava: prijavljen čita; admin dodaje i menja (proverava politika ispod).
-- Gost ne vidi ništa, DELETE niko.
revoke all on table public.categories from anon, authenticated;
grant select, insert, update on table public.categories to authenticated;

-- Politika: aktivan korisnik vidi aktivne kategorije; admin vidi i neaktivne.
create policy categories_select_active_or_admin
  on public.categories
  for select
  to authenticated
  using (
    (is_active and public.current_user_role() is not null)
    or public.is_admin()
  );

-- Politika: samo admin dodaje kategorije.
create policy categories_insert_admin
  on public.categories
  for insert
  to authenticated
  with check (public.is_admin());

-- Politika: samo admin menja kategorije (uključujući deaktivaciju).
create policy categories_update_admin
  on public.categories
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
