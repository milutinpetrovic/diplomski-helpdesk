-- =============================================================================
-- Migracija 10: funkcije za kontrolni panel (Faza 6, UC-25)
--
-- Šta je ovde:
--   - ticket_counts(): broj zahteva po statusu, prioritetu i dodeli, za sve
--     uloge (korisnik broji samo svoje zahteve, jer važi RLS)
--   - agent_dashboard_stats(): prosečna ocena (CSAT) i broj rešenih zahteva
--     prijavljenog agenta ili admina
--
-- Obe funkcije su `security invoker` (podrazumevano): izvršavaju se sa
-- pravima pozivaoca, pa RLS politike nad tickets i ticket_ratings važe kao
-- i za obično čitanje. Zato ne mogu da otkriju ništa što pozivalac ne bi
-- video i kroz listu zahteva. Brojanje se radi u bazi (jedan upit), umesto da
-- se svi zahtevi učitavaju u aplikaciju.
--
-- Koristi ih: DashboardService (src/services/dashboard/dashboard-service.ts).
-- Dokumentacija: docs/02-baza-podataka.md, sekcija 6.
-- =============================================================================

-- Funkcija ticket_counts: broj zahteva grupisan po statusu, prioritetu i
-- odnosu prema prijavljenom korisniku:
--   assignment = 'me'         - zahtev je dodeljen prijavljenom korisniku
--   assignment = 'unassigned' - zahtev nije dodeljen nikome
--   assignment = 'other'      - zahtev je dodeljen nekom drugom
-- Vraća samo kombinacije koje postoje (bez redova sa nulom).
-- Korisnik dobija samo svoje zahteve (RLS), agent i admin sve.
create function public.ticket_counts()
returns table (
  status public.ticket_status,
  priority public.ticket_priority,
  assignment text,
  total integer
)
language sql
stable
set search_path = ''
as $$
  select
    t.status,
    t.priority,
    case
      when t.assigned_to is null then 'unassigned'
      when t.assigned_to = auth.uid() then 'me'
      else 'other'
    end as assignment,
    count(*)::integer as total
  from public.tickets t
  group by 1, 2, 3;
$$;

-- Funkcija agent_dashboard_stats: podaci za kontrolni panel agenta (i admina)
-- o NJEGOVOM radu:
--   avg_rating     - prosečna CSAT ocena zahteva koji su mu dodeljeni (null ako ih nema)
--   rating_count   - broj takvih ocena
--   resolved_count - broj njegovih zahteva koji su rešeni ili zatvoreni
-- Greška FORBIDDEN ako pozivalac nije član tima podrške (korisnik nema „svoj rad“).
create function public.agent_dashboard_stats()
returns table (
  avg_rating numeric,
  rating_count integer,
  resolved_count integer
)
language plpgsql
stable
set search_path = ''
as $$
begin
  -- Korak 1: samo agent i admin (aktivni).
  if not public.is_staff() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  -- Korak 2: ocene i broj rešenih zahteva dodeljenih pozivaocu.
  return query
  select
    (
      select round(avg(r.score), 2)
      from public.ticket_ratings r
      join public.tickets t on t.id = r.ticket_id
      where t.assigned_to = auth.uid()
    ) as avg_rating,
    (
      select count(*)::integer
      from public.ticket_ratings r
      join public.tickets t on t.id = r.ticket_id
      where t.assigned_to = auth.uid()
    ) as rating_count,
    (
      select count(*)::integer
      from public.tickets t
      where t.assigned_to = auth.uid()
        and t.status in ('resolved', 'closed')
    ) as resolved_count;
end;
$$;

-- Prava izvršavanja: samo prijavljeni korisnici (gost nema šta da broji).
revoke execute on function public.ticket_counts() from public, anon;
revoke execute on function public.agent_dashboard_stats() from public, anon;
grant execute on function public.ticket_counts() to authenticated;
grant execute on function public.agent_dashboard_stats() to authenticated;
