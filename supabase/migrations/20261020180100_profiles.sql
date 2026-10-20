-- =============================================================================
-- Migracija 2: profili korisnika
--
-- Šta je ovde:
--   - tabela `profiles` (jedan red po nalogu iz auth.users)
--   - triger `handle_new_user`: novi nalog (email ili Google) dobija profil
--     sa ulogom `customer`
--   - triger `sync_profile_email`: promena emaila u auth.users se prepisuje
--     u profil
--   - triger `set_updated_at`: održava kolonu updated_at (koriste ga i druge
--     tabele)
--   - triger `prevent_role_self_change`: korisnik ne može sam sebi da promeni
--     ulogu, aktivnost ili email
--
-- RLS politike za `profiles` su u migraciji 3 (posle pomoćnih funkcija).
-- Dokumentacija: docs/02-baza-podataka.md, sekcije 3.1 i 5.
-- =============================================================================

-- Tabela profiles: proširuje Supabase nalog (auth.users) podacima aplikacije.
-- `id` je isti kao id naloga; brisanjem naloga briše se i profil.
-- Ime je 1–100 karaktera (a ne 2–100) jer Google ponekad vrati kratko ime;
-- strože pravilo (2–100) proverava Zod šema u formi za registraciju.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 100),
  email text not null unique,
  avatar_url text,
  role public.user_role not null default 'customer',
  locale text not null default 'sr' check (locale in ('en', 'sr')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profil i uloga korisnika. Red kreira triger handle_new_user, ulogu menja samo admin (admin_update_user).';

-- Indeks za filtriranje po ulozi (npr. spisak agenata za dodelu zahteva).
create index profiles_role_idx on public.profiles (role);

-- Funkcija set_updated_at: zajednička triger funkcija koja pre svakog UPDATE-a
-- upisuje trenutno vreme u kolonu updated_at. Koriste je profiles, tickets
-- i ticket_comments.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Triger: osvežava profiles.updated_at pri svakoj izmeni profila.
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Funkcija handle_new_user: posle kreiranja naloga u auth.users pravi profil.
--   1. ime: full_name iz forme za registraciju, ili `name` iz Google profila,
--      ili deo emaila pre @ (rezerva da ime nikad ne bude prazno)
--   2. slika: avatar_url iz Google profila (ako postoji)
--   3. jezik: locale iz forme ako je 'en' ili 'sr', inače 'sr'
--   4. uloga je uvek `customer` (podrazumevana vrednost kolone)
-- `security definer` jer se izvršava u ime Supabase Auth servisa, koji nema
-- pravo upisa u public.profiles.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text;
  v_locale text;
begin
  -- Korak 1: ime iz metapodataka, uz rezervu iz emaila.
  v_name := coalesce(
    nullif(trim(v_meta ->> 'full_name'), ''),
    nullif(trim(v_meta ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  -- Korak 3: jezik samo ako je jedna od podržanih vrednosti.
  v_locale := case when v_meta ->> 'locale' in ('en', 'sr') then v_meta ->> 'locale' else 'sr' end;

  -- Korak 4: upis profila (uloga = customer po podrazumevanoj vrednosti).
  insert into public.profiles (id, full_name, email, avatar_url, locale)
  values (new.id, left(v_name, 100), new.email, nullif(v_meta ->> 'avatar_url', ''), v_locale);

  return new;
end;
$$;

-- Triger: svaki novi nalog (registracija emailom ili prvi Google login)
-- odmah dobija profil.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Funkcija sync_profile_email: kad korisnik promeni email u Supabase Auth-u,
-- ista promena se upisuje u profiles.email (kopija služi za pretragu i prikaz).
create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

-- Triger: pokreće sinhronizaciju samo kad se email zaista promenio.
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

-- Funkcija prevent_role_self_change: dodatna zaštita uz prava na kolone.
-- Ako izmenu radi običan prijavljeni korisnik (uloga baze `authenticated`)
-- ili gost (`anon`), zabranjena je promena uloge, aktivnosti i emaila.
-- Admin ove kolone menja preko RPC funkcije admin_update_user, koja se
-- izvršava kao vlasnik baze, pa je ovaj triger ne blokira.
-- Namerno NIJE `security definer`: treba nam stvarni pozivalac (current_user).
create function private.prevent_role_self_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
    and (
      new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email
    )
  then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Triger: proverava svaku izmenu profila pre upisa.
create trigger profiles_prevent_role_self_change
  before update on public.profiles
  for each row execute function private.prevent_role_self_change();
