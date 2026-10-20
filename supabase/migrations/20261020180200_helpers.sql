-- =============================================================================
-- Migracija 3: pomoćne funkcije za proveru uloge + RLS za profiles
--
-- Šta je ovde:
--   - current_user_role(): uloga prijavljenog korisnika (null ako je
--     neprijavljen ili deaktiviran)
--   - is_staff(), is_admin(): skraćenice koje koriste RLS politike
--   - RLS politike i prava za tabelu profiles
--   - pogled profile_summaries: javni deo profila (ime, slika, uloga) bez emaila
--
-- Konvencija za greške u bazi (važi za sve migracije):
--   raise exception using message = '<KOD_GREŠKE>', errcode = 'P0001';
-- Servisni sloj (TypeScript) čita `message` i pretvara ga u ErrorCode
-- (docs/06-api-i-stranice.md, sekcija 1).
-- =============================================================================

-- Funkcija current_user_role: vraća ulogu prijavljenog korisnika.
-- Vraća null ako niko nije prijavljen ILI ako je nalog deaktiviran
-- (is_active = false) — tako sve politike koje traže ulogu automatski
-- zaključavaju deaktivirane naloge.
-- `security definer` da bi mogla da čita profiles bez rekurzije kroz RLS
-- (politike na profiles i same pozivaju ovu funkciju).
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active;
$$;

-- Funkcija is_staff: da li je prijavljeni korisnik agent ili admin (i aktivan).
create function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('agent', 'admin'), false);
$$;

-- Funkcija is_admin: da li je prijavljeni korisnik admin (i aktivan).
create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- Prava izvršavanja: samo prijavljeni korisnici (gost nema ulogu).
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- RLS za profiles
-- -----------------------------------------------------------------------------

-- Uključujemo RLS: bez politike niko (osim vlasnika baze) ne vidi nijedan red.
alter table public.profiles enable row level security;

-- Prava na nivou tabele i kolona. Supabase podrazumevano daje sva prava
-- ulogama anon i authenticated, pa ih ovde eksplicitno sužavamo:
--   - gost (anon): ništa
--   - prijavljen: čitanje + izmena samo kolona full_name, avatar_url, locale
--   - INSERT radi samo triger handle_new_user, DELETE niko (deaktivacija)
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url, locale) on table public.profiles to authenticated;

-- Politika: svako vidi svoj profil; agent i admin vide sve profile.
-- Deaktiviran korisnik ne vidi ništa (current_user_role() je null).
create policy profiles_select_own_or_staff
  on public.profiles
  for select
  to authenticated
  using (
    (id = auth.uid() and public.current_user_role() is not null)
    or public.is_staff()
  );

-- Politika: aktivan korisnik menja samo svoj profil (i to samo kolone
-- dozvoljene iznad). Ulogu i aktivnost menja admin kroz admin_update_user.
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() and public.current_user_role() is not null)
  with check (id = auth.uid());

-- Pogled profile_summaries: ime, slika i uloga BEZ emaila.
-- Služi da korisnik vidi ko mu je odgovorio (ime agenta uz komentar), a da
-- ne može da čita emailove drugih. Vidljivi redovi:
--   - sopstveni profil
--   - profili agenata i admina (aktivnih)
--   - svi profili ako je pozivalac agent ili admin
-- Pogled se izvršava sa pravima vlasnika (zato zaobilazi RLS na profiles),
-- a filtriranje radi WHERE uslov ispod.
create view public.profile_summaries as
  select p.id, p.full_name, p.avatar_url, p.role
  from public.profiles p
  where public.current_user_role() is not null
    and (
      p.id = auth.uid()
      or (p.role in ('agent', 'admin') and p.is_active)
      or public.is_staff()
    );

comment on view public.profile_summaries is
  'Javni deo profila (bez emaila) za prikaz imena autora komentara i dodeljenog agenta.';

revoke all on table public.profile_summaries from anon, authenticated;
grant select on table public.profile_summaries to authenticated;
