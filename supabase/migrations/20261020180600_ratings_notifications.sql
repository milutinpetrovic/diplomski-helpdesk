-- =============================================================================
-- Migracija 7: ocene zadovoljstva i obaveštenja
--
-- Šta je ovde:
--   - tabela `ticket_ratings` (CSAT ocena 1–5, jedna po zahtevu) + RLS
--   - tabela `notifications` + RLS
--   - dodavanje `notifications` u real-time publikaciju (glavni real-time kanal)
--
-- Dokumentacija: docs/02-baza-podataka.md, sekcije 3.6, 3.7, 7 i 8.
-- =============================================================================

-- Tabela ticket_ratings: ocena koju vlasnik daje kad je zahtev rešen.
-- `unique (ticket_id)` garantuje najviše jednu ocenu po zahtevu.
create table public.ticket_ratings (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets (id) on delete cascade,
  rated_by uuid not null references public.profiles (id),
  score smallint not null check (score between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

comment on table public.ticket_ratings is
  'CSAT ocene (1–5). Upis samo kroz rate_ticket, kad je zahtev rešen ili zatvoren.';

-- Uključujemo RLS i ostavljamo samo pravo čitanja (upis kroz rate_ticket).
alter table public.ticket_ratings enable row level security;
revoke all on table public.ticket_ratings from anon, authenticated;
grant select on table public.ticket_ratings to authenticated;

-- Politika: ocenu vidi onaj ko sme da vidi zahtev (vlasnik ili agent/admin).
create policy ticket_ratings_select
  on public.ticket_ratings
  for select
  to authenticated
  using (public.can_view_ticket(ticket_id));

-- Tabela notifications: obaveštenje za jednog primaoca.
-- Namerno NE čuva tekst (naslov zahteva, sadržaj komentara): UI tekst sastavlja
-- iz `type` i podataka koje dobije kroz API, pa nema curenja internog sadržaja.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  ticket_id uuid references public.tickets (id) on delete cascade,
  type public.notification_type not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Obaveštenja. Upisuju ih RPC funkcije; primalac čita, označava kao pročitano i briše. U real-time publikaciji.';

-- Indeks: lista obaveštenja i brojač nepročitanih za jednog korisnika.
create index notifications_recipient_idx
  on public.notifications (recipient_id, is_read, created_at desc);

-- Uključujemo RLS.
alter table public.notifications enable row level security;

-- Prava: čitanje, izmena SAMO kolone is_read, brisanje. Upis rade RPC funkcije.
revoke all on table public.notifications from anon, authenticated;
grant select, delete on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

-- Politika: korisnik vidi samo svoja obaveštenja. Supabase Realtime poštuje
-- ovu politiku, pa i preko real-time veze stižu samo sopstvena obaveštenja.
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (recipient_id = auth.uid() and public.current_user_role() is not null);

-- Politika: korisnik označava kao pročitana samo svoja obaveštenja.
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (recipient_id = auth.uid() and public.current_user_role() is not null)
  with check (recipient_id = auth.uid());

-- Politika: korisnik briše samo svoja obaveštenja.
create policy notifications_delete_own
  on public.notifications
  for delete
  to authenticated
  using (recipient_id = auth.uid() and public.current_user_role() is not null);

-- Real-time: nova obaveštenja se šalju klijentu odmah (postgres_changes,
-- filter recipient_id=eq.<moj id>). Samo ova tabela ide u publikaciju.
alter publication supabase_realtime add table public.notifications;
