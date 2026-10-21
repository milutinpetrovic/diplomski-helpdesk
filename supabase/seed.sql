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
--   3. 12 demo zahteva sa komentarima, istorijom i jednom ocenom (Faza 5)
--   4. obaveštenja za te zahteve, novija nepročitana (Faza 7)
--
-- ID-jevi naloga su fiksni da bi ih testovi mogli koristiti.
-- Veliki skup demo zahteva (~150) pravi skripta u Fazi 8 (scripts/seed-demo.mts).
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

-- =============================================================================
-- Korak 5: demo zahtevi (Faza 5) — 12 zahteva u svim statusima, da se posle
-- `supabase db reset` odmah ima šta gledati u aplikaciji i u Swagger-u.
--   - vlasnici: Ana (6 zahteva) i Marko (6); agenti: Jelena i Nikola
--   - statusi: 3 open (nedodeljeni), 2 in_progress, 2 waiting_on_customer,
--     2 resolved (Ana može da oceni #4), 3 closed (jedan otkazan, jedan ocenjen)
--   - javni komentari, interne beleške (korisnik ih ne vidi), istorija, 1 ocena
-- Vremena su relativna u odnosu na trenutak pokretanja (now() - interval),
-- pa demo podaci uvek izgledaju sveže. Upisuje se direktno u tabele (seed
-- radi kao vlasnik baze, mimo RPC funkcija), zato su sve vremenske oznake i
-- istorija ovde ručno usklađene sa pravilima iz docs/02 (sekcija 4):
--   first_response_at = prvi javni komentar agenta, resolved_at / closed_at
--   = trenutak prelaza u resolved / closed.
-- ID-jevi su fiksni (20000000-...-0000000000NN), pa je npr. ...0001 primer
-- u Swagger-u. Broj zahteva (#1001...) dodeljuje baza redom upisa.
-- Veliki skup podataka za grafikone analitike pravi skripta u Fazi 8.
-- =============================================================================

-- 5a: zahtevi.
insert into public.tickets (
  id, title, description, status, priority, category_id, created_by, assigned_to,
  first_response_at, resolved_at, closed_at, created_at, updated_at
)
values
  ('20000000-0000-4000-8000-000000000001', 'Ne radi štampač u kancelariji 12',
   'Od jutros štampač HP u kancelariji 12 javlja grešku E-04 i ne štampa ništa. Probala sam da ga isključim i uključim, ali greška ostaje.',
   'in_progress', 'high', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002',
   now() - interval '69 hours', null, null, now() - interval '72 hours', now() - interval '48 hours'),
  ('20000000-0000-4000-8000-000000000002', 'Ne mogu da se prijavim na portal za zaposlene',
   'Posle promene lozinke portal stalno javlja „Pogrešni podaci“, iako sam sigurna da je lozinka tačna.',
   'open', 'urgent', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', null,
   null, null, null, now() - interval '2 hours', now() - interval '2 hours'),
  ('20000000-0000-4000-8000-000000000003', 'Pogrešan iznos na računu za oktobar',
   'Na računu za oktobar je naplaćeno 12 korisničkih licenci, a mi koristimo 10.',
   'waiting_on_customer', 'medium', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003',
   now() - interval '116 hours', null, null, now() - interval '120 hours', now() - interval '116 hours'),
  ('20000000-0000-4000-8000-000000000004', 'Aplikacija se ruši pri izvozu u PDF',
   'Kada kliknem na „Izvezi u PDF“ za izveštaj sa više od 50 strana, aplikacija se zatvori bez poruke.',
   'resolved', 'high', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002',
   now() - interval '188 hours', now() - interval '24 hours', null, now() - interval '192 hours', now() - interval '24 hours'),
  ('20000000-0000-4000-8000-000000000005', 'Predlog: tamna tema u aplikaciji',
   'Bilo bi lepo da aplikacija ima tamnu temu za rad uveče.',
   'closed', 'low', '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003',
   now() - interval '370 hours', now() - interval '360 hours', now() - interval '340 hours', now() - interval '480 hours', now() - interval '339 hours'),
  ('20000000-0000-4000-8000-000000000006', 'Duplirana uplata pretplate',
   'Izgleda da mi je pretplata naplaćena dva puta ovog meseca.',
   'closed', 'medium', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', null,
   null, null, now() - interval '140 hours', now() - interval '150 hours', now() - interval '140 hours'),
  ('20000000-0000-4000-8000-000000000007', 'Spora aplikacija posle ažuriranja',
   'Od poslednjeg ažuriranja otvaranje liste projekata traje i po 20 sekundi.',
   'in_progress', 'medium', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003',
   now() - interval '19 hours', null, null, now() - interval '26 hours', now() - interval '19 hours'),
  ('20000000-0000-4000-8000-000000000008', 'Kako da dodam novog korisnika u tim?',
   'Treba da dodam koleginicu u naš tim, ali ne vidim gde se to podešava.',
   'open', 'low', '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', null,
   null, null, null, now() - interval '6 hours', now() - interval '6 hours'),
  ('20000000-0000-4000-8000-000000000009', 'Greška 500 pri čuvanju profila',
   'Kada promenim broj telefona u profilu i kliknem „Sačuvaj“, dobijam grešku 500.',
   'resolved', 'urgent', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002',
   now() - interval '94 hours', now() - interval '6 hours', null, now() - interval '96 hours', now() - interval '6 hours'),
  ('20000000-0000-4000-8000-000000000010', 'Promena email adrese na nalogu',
   'Prešla sam na novu službenu adresu i želim da je promenim na nalogu.',
   'open', 'low', '10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', null,
   null, null, null, now() - interval '24 hours', now() - interval '24 hours'),
  ('20000000-0000-4000-8000-000000000011', 'Izvoz izveštaja u Excel',
   'Da li postoji mogućnost izvoza mesečnog izveštaja u Excel format?',
   'waiting_on_customer', 'medium', '10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002',
   now() - interval '44 hours', null, null, now() - interval '48 hours', now() - interval '44 hours'),
  ('20000000-0000-4000-8000-000000000012', 'Račun nije stigao na email',
   'Račun za septembar nije stigao na moju email adresu.',
   'closed', 'medium', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003',
   now() - interval '250 hours', now() - interval '250 hours', now() - interval '230 hours', now() - interval '288 hours', now() - interval '230 hours');

-- 5b: komentari (is_internal = true su interne beleške tima podrške).
insert into public.ticket_comments (ticket_id, author_id, body, is_internal, created_at, updated_at)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Hvala na prijavi. Da li je na displeju i poruka o papiru ili samo kod E-04?', false, now() - interval '69 hours', now() - interval '69 hours'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'Samo E-04, papira ima dovoljno.', false, now() - interval '50 hours', now() - interval '50 hours'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'E-04 je obično toner. Proveriti da li imamo rezervni toner u magacinu.', true, now() - interval '48 hours', now() - interval '48 hours'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'U sistemu za naplatu vidim 12 aktivnih licenci; dve su možda ostale od bivših zaposlenih.', true, now() - interval '117 hours', now() - interval '117 hours'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'Pošaljite nam, molim vas, broj računa i spisak korisnika koje trenutno koristite.', false, now() - interval '116 hours', now() - interval '116 hours'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'Uspela sam da ponovim problem, prosleđujem ga razvoju.', false, now() - interval '188 hours', now() - interval '188 hours'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'Razvoj potvrdio grešku sa memorijom pri velikim izveštajima; ispravka ide u verziju 2.4.1.', true, now() - interval '100 hours', now() - interval '100 hours'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'Ispravka je objavljena u verziji 2.4.1. Ažurirajte aplikaciju i javite da li sada radi.', false, now() - interval '24 hours', now() - interval '24 hours'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 'Odličan predlog, dodali smo ga u plan razvoja. Tamna tema je dostupna od verzije 2.3.', false, now() - interval '370 hours', now() - interval '370 hours'),
  ('20000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', 'Izvinjavam se, banka je ipak vratila drugu uplatu. Otkazujem zahtev.', false, now() - interval '140 hours', now() - interval '140 hours'),
  ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000003', 'Proveravamo performanse servera, javljamo se uskoro.', false, now() - interval '19 hours', now() - interval '19 hours'),
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', 'Hvala, problem je kod formata broja telefona. Popravljamo.', false, now() - interval '94 hours', now() - interval '94 hours'),
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', 'Greška je ispravljena, čuvanje profila sada radi.', false, now() - interval '6 hours', now() - interval '6 hours'),
  ('20000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', 'Izvoz u CSV postoji u meniju Izveštaji. Da li vam CSV odgovara ili je potreban baš .xlsx?', false, now() - interval '44 hours', now() - interval '44 hours'),
  ('20000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000003', 'Račun smo ponovo poslali, proverite i folder za neželjenu poštu.', false, now() - interval '250 hours', now() - interval '250 hours');

-- 5c: istorija promena (actor_id = null je automatski prelaz: vlasnik je
-- odgovorio na zahtev koji je čekao njega). Milisekunde čuvaju redosled
-- stavki koje su se desile u istom trenutku.
insert into public.ticket_history (ticket_id, actor_id, action, old_value, new_value, created_at)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'created', null, '{"status": "open", "priority": "high", "category_id": "10000000-0000-4000-8000-000000000001"}'::jsonb, now() - interval '72 hours' + interval '0 milliseconds'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'assigned', '{"assigned_to": null}'::jsonb, '{"assigned_to": "00000000-0000-4000-8000-000000000002"}'::jsonb, now() - interval '70 hours' + interval '1 milliseconds'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'status_changed', '{"status": "open"}'::jsonb, '{"status": "in_progress"}'::jsonb, now() - interval '70 hours' + interval '2 milliseconds'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'status_changed', '{"status": "in_progress"}'::jsonb, '{"status": "waiting_on_customer"}'::jsonb, now() - interval '69 hours' + interval '3 milliseconds'),
  ('20000000-0000-4000-8000-000000000001', null, 'status_changed', '{"status": "waiting_on_customer"}'::jsonb, '{"status": "in_progress"}'::jsonb, now() - interval '50 hours' + interval '4 milliseconds'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', 'created', null, '{"status": "open", "priority": "urgent", "category_id": "10000000-0000-4000-8000-000000000002"}'::jsonb, now() - interval '2 hours' + interval '5 milliseconds'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', 'created', null, '{"status": "open", "priority": "medium", "category_id": "10000000-0000-4000-8000-000000000003"}'::jsonb, now() - interval '120 hours' + interval '6 milliseconds'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'assigned', '{"assigned_to": null}'::jsonb, '{"assigned_to": "00000000-0000-4000-8000-000000000003"}'::jsonb, now() - interval '118 hours' + interval '7 milliseconds'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'status_changed', '{"status": "open"}'::jsonb, '{"status": "in_progress"}'::jsonb, now() - interval '118 hours' + interval '8 milliseconds'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'status_changed', '{"status": "in_progress"}'::jsonb, '{"status": "waiting_on_customer"}'::jsonb, now() - interval '116 hours' + interval '9 milliseconds'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 'created', null, '{"status": "open", "priority": "high", "category_id": "10000000-0000-4000-8000-000000000001"}'::jsonb, now() - interval '192 hours' + interval '10 milliseconds'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'assigned', '{"assigned_to": null}'::jsonb, '{"assigned_to": "00000000-0000-4000-8000-000000000002"}'::jsonb, now() - interval '190 hours' + interval '11 milliseconds'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'status_changed', '{"status": "open"}'::jsonb, '{"status": "in_progress"}'::jsonb, now() - interval '190 hours' + interval '12 milliseconds'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'status_changed', '{"status": "in_progress"}'::jsonb, '{"status": "resolved"}'::jsonb, now() - interval '24 hours' + interval '13 milliseconds'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 'created', null, '{"status": "open", "priority": "low", "category_id": "10000000-0000-4000-8000-000000000004"}'::jsonb, now() - interval '480 hours' + interval '14 milliseconds'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 'assigned', '{"assigned_to": null}'::jsonb, '{"assigned_to": "00000000-0000-4000-8000-000000000003"}'::jsonb, now() - interval '470 hours' + interval '15 milliseconds'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 'status_changed', '{"status": "open"}'::jsonb, '{"status": "in_progress"}'::jsonb, now() - interval '470 hours' + interval '16 milliseconds'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 'status_changed', '{"status": "in_progress"}'::jsonb, '{"status": "resolved"}'::jsonb, now() - interval '360 hours' + interval '17 milliseconds'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 'status_changed', '{"status": "resolved"}'::jsonb, '{"status": "closed"}'::jsonb, now() - interval '340 hours' + interval '18 milliseconds'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 'rated', null, '{"score": 5}'::jsonb, now() - interval '339 hours' + interval '19 milliseconds'),
  ('20000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', 'created', null, '{"status": "open", "priority": "medium", "category_id": "10000000-0000-4000-8000-000000000003"}'::jsonb, now() - interval '150 hours' + interval '20 milliseconds'),
  ('20000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', 'status_changed', '{"status": "open"}'::jsonb, '{"status": "closed"}'::jsonb, now() - interval '140 hours' + interval '21 milliseconds'),
  ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000005', 'created', null, '{"status": "open", "priority": "medium", "category_id": "10000000-0000-4000-8000-000000000001"}'::jsonb, now() - interval '26 hours' + interval '22 milliseconds'),
  ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000003', 'assigned', '{"assigned_to": null}'::jsonb, '{"assigned_to": "00000000-0000-4000-8000-000000000003"}'::jsonb, now() - interval '20 hours' + interval '23 milliseconds'),
  ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000003', 'status_changed', '{"status": "open"}'::jsonb, '{"status": "in_progress"}'::jsonb, now() - interval '20 hours' + interval '24 milliseconds'),
  ('20000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000005', 'created', null, '{"status": "open", "priority": "low", "category_id": "10000000-0000-4000-8000-000000000005"}'::jsonb, now() - interval '6 hours' + interval '25 milliseconds'),
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000005', 'created', null, '{"status": "open", "priority": "urgent", "category_id": "10000000-0000-4000-8000-000000000001"}'::jsonb, now() - interval '96 hours' + interval '26 milliseconds'),
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', 'assigned', '{"assigned_to": null}'::jsonb, '{"assigned_to": "00000000-0000-4000-8000-000000000002"}'::jsonb, now() - interval '95 hours' + interval '27 milliseconds'),
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', 'status_changed', '{"status": "open"}'::jsonb, '{"status": "in_progress"}'::jsonb, now() - interval '95 hours' + interval '28 milliseconds'),
  ('20000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', 'status_changed', '{"status": "in_progress"}'::jsonb, '{"status": "resolved"}'::jsonb, now() - interval '6 hours' + interval '29 milliseconds'),
  ('20000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000004', 'created', null, '{"status": "open", "priority": "low", "category_id": "10000000-0000-4000-8000-000000000002"}'::jsonb, now() - interval '24 hours' + interval '30 milliseconds'),
  ('20000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000005', 'created', null, '{"status": "open", "priority": "medium", "category_id": "10000000-0000-4000-8000-000000000004"}'::jsonb, now() - interval '48 hours' + interval '31 milliseconds'),
  ('20000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', 'assigned', '{"assigned_to": null}'::jsonb, '{"assigned_to": "00000000-0000-4000-8000-000000000002"}'::jsonb, now() - interval '45 hours' + interval '32 milliseconds'),
  ('20000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', 'status_changed', '{"status": "open"}'::jsonb, '{"status": "in_progress"}'::jsonb, now() - interval '45 hours' + interval '33 milliseconds'),
  ('20000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002', 'status_changed', '{"status": "in_progress"}'::jsonb, '{"status": "waiting_on_customer"}'::jsonb, now() - interval '44 hours' + interval '34 milliseconds'),
  ('20000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000005', 'created', null, '{"status": "open", "priority": "medium", "category_id": "10000000-0000-4000-8000-000000000003"}'::jsonb, now() - interval '288 hours' + interval '35 milliseconds'),
  ('20000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000003', 'assigned', '{"assigned_to": null}'::jsonb, '{"assigned_to": "00000000-0000-4000-8000-000000000003"}'::jsonb, now() - interval '286 hours' + interval '36 milliseconds'),
  ('20000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000003', 'status_changed', '{"status": "open"}'::jsonb, '{"status": "in_progress"}'::jsonb, now() - interval '286 hours' + interval '37 milliseconds'),
  ('20000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000003', 'status_changed', '{"status": "in_progress"}'::jsonb, '{"status": "resolved"}'::jsonb, now() - interval '250 hours' + interval '38 milliseconds'),
  ('20000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000005', 'status_changed', '{"status": "resolved"}'::jsonb, '{"status": "closed"}'::jsonb, now() - interval '230 hours' + interval '39 milliseconds');

-- 5d: jedna ocena zadovoljstva (zahtev #1005, Ana, 5 zvezdica).
insert into public.ticket_ratings (ticket_id, rated_by, score, comment, created_at)
values
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 5, 'Brzo i ljubazno, hvala!', now() - interval '339 hours');

-- 5e: obaveštenja (Faza 7), usklađena sa događajima iz 5a–5d: ko je šta
-- uradio i kada. U aplikaciji ih pravi baza (RPC funkcije); ovde se upisuju
-- direktno. Novija (poslednja 24 sata) su nepročitana, da se posle
-- `supabase db reset` odmah vidi brojač na zvoncetu za svaku ulogu:
--   Ana 2, Marko 3, Jelena 2, Nikola 2, Admin 2 nepročitana.
insert into public.notifications (recipient_id, actor_id, ticket_id, type, is_read, created_at)
values
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 'status_changed', false, now() - interval '24 hours'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 'comment_added', false, now() - interval '24 hours'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'status_changed', true, now() - interval '116 hours'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'comment_added', true, now() - interval '116 hours'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'status_changed', true, now() - interval '69 hours'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'comment_added', true, now() - interval '69 hours'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000009', 'status_changed', false, now() - interval '6 hours'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000009', 'comment_added', false, now() - interval '6 hours'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000007', 'comment_added', false, now() - interval '19 hours'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000011', 'status_changed', true, now() - interval '44 hours'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000011', 'comment_added', true, now() - interval '44 hours'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'ticket_created', false, now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000008', 'ticket_created', false, now() - interval '6 hours'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000010', 'ticket_created', true, now() - interval '24 hours'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'comment_added', true, now() - interval '50 hours'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'ticket_created', false, now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000008', 'ticket_created', false, now() - interval '6 hours'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000010', 'ticket_created', true, now() - interval '24 hours'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000005', 'ticket_rated', true, now() - interval '339 hours'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'ticket_created', false, now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000008', 'ticket_created', false, now() - interval '6 hours'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000010', 'ticket_created', true, now() - interval '24 hours');
