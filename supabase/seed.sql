-- =============================================================================
-- seed.sql — početni podaci SAMO za lokalni razvoj i testove
--
-- Pokreće ga `supabase db reset` (posle migracija). U produkciju ne ide.
-- Šta pravi:
--   1. 5 kategorija zahteva (nazivi na srpskom i engleskom)
--   2. 5 demo naloga sa poznatom lozinkom `Lozinka123!` (spisak u README-u):
--        admin@helpdesk.test   - Administrator
--        agent@helpdesk.test   - Agent
--        agent2@helpdesk.test  - Agent
--        ana@helpdesk.test     - Korisnik
--        marko@helpdesk.test   - Korisnik
--
-- ID-jevi naloga su fiksni da bi ih testovi mogli koristiti.
-- Veliki skup demo zahteva (~150) pravi skripta u Fazi 8 (scripts/seed-demo.ts).
-- =============================================================================

-- Korak 1: kategorije (fiksni ID-jevi radi testova).
insert into public.categories (id, slug, name_sr, name_en, description_sr, description_en, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', 'technical', 'Tehnički problem', 'Technical issue',
   'Greške, padovi i problemi u radu aplikacije.', 'Errors, crashes and problems using the application.', 1),
  ('10000000-0000-4000-8000-000000000002', 'account', 'Nalog i prijava', 'Account and login',
   'Prijava, lozinka i podešavanja naloga.', 'Login, password and account settings.', 2),
  ('10000000-0000-4000-8000-000000000003', 'billing', 'Naplata', 'Billing',
   'Računi, uplate i pretplata.', 'Invoices, payments and subscription.', 3),
  ('10000000-0000-4000-8000-000000000004', 'feature-request', 'Zahtev za funkcionalnost', 'Feature request',
   'Predlog nove mogućnosti ili poboljšanja.', 'Suggestion for a new feature or improvement.', 4),
  ('10000000-0000-4000-8000-000000000005', 'other', 'Ostalo', 'Other',
   'Sve što ne spada u ostale kategorije.', 'Anything that does not fit other categories.', 5);

-- Korak 2: demo nalozi u Supabase Auth-u (auth.users).
-- Lozinka se čuva kao bcrypt heš (pgcrypto: crypt + gen_salt('bf')).
-- Token kolone moraju biti prazni stringovi (ne NULL), inače Supabase Auth
-- ne može da učita nalog pri prijavi.
-- Triger handle_new_user za svaki nalog automatski pravi profil (customer).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('Lozinka123!', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name, 'locale', 'sr'),
  now(),
  now(),
  '', '', '', ''
from (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@helpdesk.test', 'Admin Adminović'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'agent@helpdesk.test', 'Jelena Agentić'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'agent2@helpdesk.test', 'Nikola Podrška'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'ana@helpdesk.test', 'Ana Anić'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'marko@helpdesk.test', 'Marko Marković')
) as u (id, email, full_name);

-- Korak 3: identiteti (Supabase Auth zahteva red u auth.identities da bi
-- prijava emailom i lozinkom radila).
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(),
  now(),
  now()
from auth.users u
where u.email like '%@helpdesk.test';

-- Korak 4: uloge tima podrške (prvi admin postoji samo preko seed-a;
-- dalje uloge dodeljuje admin kroz aplikaciju).
update public.profiles set role = 'admin' where email = 'admin@helpdesk.test';
update public.profiles set role = 'agent' where email in ('agent@helpdesk.test', 'agent2@helpdesk.test');
