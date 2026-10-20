-- =============================================================================
-- Migracija 1: enum tipovi i pomoćna šema
--
-- Šta je ovde:
--   - šema `private` za interne funkcije koje ne smeju biti dostupne kroz API
--   - enum tipovi koje koriste tabele (uloge, statusi, prioriteti, istorija,
--     obaveštenja)
--
-- Vrednosti su na engleskom (pravilo projekta: identifikatori na engleskom).
-- Prevod za prikaz ide isključivo kroz next-intl (messages/*.json).
-- Dokumentacija: docs/02-baza-podataka.md, sekcija 2.
-- =============================================================================

-- Šema `private`: interne pomoćne funkcije (upis istorije, obaveštenja, provera
-- prelaza statusa). Supabase API (PostgREST) izlaže samo šemu `public`, pa se
-- funkcije odavde ne mogu pozvati direktno iz pregledača.
create schema if not exists private;
revoke all on schema private from public;

-- Uloga korisnika u aplikaciji (RBAC). Tačno tri uloge:
--   customer = korisnik koji prijavljuje problem
--   agent    = član tima podrške koji rešava zahteve
--   admin    = administrator (upravlja korisnicima, kategorijama, analitikom)
create type public.user_role as enum ('customer', 'agent', 'admin');

-- Status zahteva. Dozvoljeni prelazi su opisani u docs/02, sekcija 4,
-- i proveravaju se u funkciji private.is_status_transition_allowed.
create type public.ticket_status as enum (
  'open',
  'in_progress',
  'waiting_on_customer',
  'resolved',
  'closed'
);

-- Prioritet zahteva.
create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');

-- Vrsta događaja u istoriji zahteva (ticket_history.action).
create type public.history_action as enum (
  'created',
  'status_changed',
  'assigned',
  'unassigned',
  'priority_changed',
  'category_changed',
  'updated',
  'rated'
);

-- Vrsta obaveštenja (notifications.type). Tekst obaveštenja se ne čuva u bazi,
-- UI ga sastavlja iz tipa (prevod u messages/*.json pod notifications.<type>).
create type public.notification_type as enum (
  'ticket_created',
  'ticket_assigned',
  'status_changed',
  'comment_added',
  'internal_comment_added',
  'ticket_rated'
);
