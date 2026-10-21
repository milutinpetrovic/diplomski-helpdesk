-- =============================================================================
-- Migracija 11: funkcije za analitiku rada tima podrške (Faza 8, UC-23)
--
-- Šta je ovde (sve četiri funkcije su samo za admina):
--   - analytics_overview(p_from, p_to): KPI brojevi i CSAT za period
--   - analytics_by_dimension(p_from, p_to, p_dimension): raspodela zahteva
--     po statusu, kategoriji ili prioritetu
--   - analytics_agents(p_from, p_to): učinak po agentu (i adminu)
--   - analytics_trend(p_from, p_to, p_bucket): kreirani i rešeni po danu/nedelji
--
-- Period: p_from i p_to su DATUMI (dani u zoni Europe/Belgrade), oba
-- uključena. Npr. 2026-10-01 .. 2026-10-31 je ceo oktobar po beogradskom
-- vremenu. Najviše 366 dana; p_from ne sme biti posle p_to (VALIDATION_ERROR).
--
-- Šta se tačno broji (isto piše u docs/02, sekcija 6):
--   - „kreirani“: created_at u periodu
--   - „rešeni“: resolved_at u periodu (zatvoren zahtev zadržava resolved_at)
--   - vreme prvog odgovora: created_at -> first_response_at, za zahteve
--     kreirane u periodu koji imaju odgovor
--   - vreme rešavanja: created_at -> resolved_at, za zahteve rešene u periodu
--   - CSAT: ocene date (created_at ocene) u periodu
--   - „trenutno otvoreni“: nerešeni zahtevi sada, ne zavisi od perioda
--
-- Funkcije su `security invoker` (podrazumevano): rade sa pravima pozivaoca
-- i pod RLS-om. Na početku proveravaju da je pozivalac aktivan admin
-- (inače FORBIDDEN), pa agent i korisnik ne dobijaju ništa ni kad zaobiđu API.
-- Sve vreme se vraća u MINUTIMA (UI ga prikazuje kao „2 h 15 min“).
--
-- Koristi ih: AnalyticsService (src/services/analytics/analytics-service.ts).
-- Dokumentacija: docs/02-baza-podataka.md, sekcija 6.
-- =============================================================================

-- Pomoćna funkcija analytics_bounds: proverava period i pretvara datume u
-- vremenske trenutke [početak prvog dana, početak dana posle poslednjeg)
-- po beogradskom vremenu (uzima u obzir letnje računanje vremena).
-- Greške: FORBIDDEN ako pozivalac nije admin, VALIDATION_ERROR za loš period.
-- Javna je jer je pozivaju funkcije sa pravima pozivaoca; sama ne čita podatke.
create function public.analytics_bounds(p_from date, p_to date)
returns table (range_start timestamptz, range_end timestamptz)
language plpgsql
stable
set search_path = ''
as $$
begin
  -- Korak 1: samo aktivan admin.
  if not public.is_admin() then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  -- Korak 2: ispravan period (od <= do, najviše 366 dana).
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 365 then
    raise exception using message = 'VALIDATION_ERROR', errcode = 'P0001';
  end if;

  -- Korak 3: granice perioda kao trenuci u vremenu.
  return query
  select
    (p_from::timestamp at time zone 'Europe/Belgrade') as range_start,
    ((p_to + 1)::timestamp at time zone 'Europe/Belgrade') as range_end;
end;
$$;

-- Funkcija analytics_overview: KPI kartice na stranici /analytics.
--   created_count  - kreirano u periodu
--   resolved_count - rešeno u periodu
--   closed_count   - zatvoreno u periodu
--   open_count     - trenutno nerešeni (open, in_progress, waiting_on_customer)
--   avg_first_response_minutes - prosečno vreme do prvog javnog odgovora tima
--   avg_resolution_minutes     - prosečno vreme od kreiranja do rešenja
--   avg_rating, rating_count   - prosečna CSAT ocena i broj ocena u periodu
--   rating_distribution        - broj ocena 1, 2, 3, 4 i 5 (niz od 5 brojeva)
-- Prosečne vrednosti su null kad nema podataka (UI prikazuje „—“).
create function public.analytics_overview(p_from date, p_to date)
returns table (
  created_count integer,
  resolved_count integer,
  closed_count integer,
  open_count integer,
  avg_first_response_minutes numeric,
  avg_resolution_minutes numeric,
  avg_rating numeric,
  rating_count integer,
  rating_distribution integer[]
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  -- Korak 1: provera uloge i perioda, granice perioda.
  select b.range_start, b.range_end into v_start, v_end
  from public.analytics_bounds(p_from, p_to) b;

  -- Korak 2: svi brojevi u jednom upitu (podupiti nad tickets i ticket_ratings).
  return query
  select
    (select count(*)::integer from public.tickets t
      where t.created_at >= v_start and t.created_at < v_end),
    (select count(*)::integer from public.tickets t
      where t.resolved_at >= v_start and t.resolved_at < v_end),
    (select count(*)::integer from public.tickets t
      where t.closed_at >= v_start and t.closed_at < v_end),
    (select count(*)::integer from public.tickets t
      where t.status in ('open', 'in_progress', 'waiting_on_customer')),
    (select round(avg(extract(epoch from (t.first_response_at - t.created_at)) / 60), 1)
      from public.tickets t
      where t.created_at >= v_start and t.created_at < v_end
        and t.first_response_at is not null),
    (select round(avg(extract(epoch from (t.resolved_at - t.created_at)) / 60), 1)
      from public.tickets t
      where t.resolved_at >= v_start and t.resolved_at < v_end),
    (select round(avg(r.score), 2) from public.ticket_ratings r
      where r.created_at >= v_start and r.created_at < v_end),
    (select count(*)::integer from public.ticket_ratings r
      where r.created_at >= v_start and r.created_at < v_end),
    -- Raspodela ocena: za svaku ocenu 1..5 broj ocena u periodu (i nule).
    (select array_agg(coalesce(c.total, 0) order by s.score)
      from generate_series(1, 5) as s(score)
      left join (
        select r.score, count(*)::integer as total
        from public.ticket_ratings r
        where r.created_at >= v_start and r.created_at < v_end
        group by r.score
      ) c on c.score = s.score);
end;
$$;

-- Funkcija analytics_by_dimension: broj zahteva kreiranih u periodu,
-- grupisano po izabranoj dimenziji:
--   p_dimension = 'status'   -> key je status (open, in_progress, ...)
--   p_dimension = 'priority' -> key je prioritet (low, medium, high, urgent)
--   p_dimension = 'category' -> key je ID kategorije (naziv dodaje servis)
-- Vraća samo grupe koje postoje; nule za ostale vrednosti dodaje servis.
-- Nepoznata dimenzija: VALIDATION_ERROR.
create function public.analytics_by_dimension(p_from date, p_to date, p_dimension text)
returns table (key text, total integer)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  -- Korak 1: provera uloge i perioda.
  select b.range_start, b.range_end into v_start, v_end
  from public.analytics_bounds(p_from, p_to) b;

  -- Korak 2: provera dimenzije.
  if p_dimension not in ('status', 'priority', 'category') then
    raise exception using message = 'VALIDATION_ERROR', errcode = 'P0001';
  end if;

  -- Korak 3: grupisanje po izabranoj koloni.
  return query
  select
    case p_dimension
      when 'status' then t.status::text
      when 'priority' then t.priority::text
      else t.category_id::text
    end as key,
    count(*)::integer as total
  from public.tickets t
  where t.created_at >= v_start and t.created_at < v_end
  group by 1;
end;
$$;

-- Funkcija analytics_agents: tabela učinka tima za period. Jedan red po
-- članu tima (agent ili admin) koji je aktivan ILI ima neki rezultat u periodu.
--   assigned_count - zahtevi kreirani u periodu koji su mu sada dodeljeni
--   resolved_count - njegovi zahtevi rešeni u periodu
--   avg_resolution_minutes - prosečno vreme rešavanja tih zahteva
--   avg_rating, rating_count - CSAT ocene njegovih zahteva date u periodu
-- Napomena (ide i u rad): računa se po TRENUTNOM agentu na zahtevu; ako je
-- zahtev predat drugom agentu, rezultat ide onome ko ga sada ima.
create function public.analytics_agents(p_from date, p_to date)
returns table (
  agent_id uuid,
  full_name text,
  role public.user_role,
  is_active boolean,
  assigned_count integer,
  resolved_count integer,
  avg_resolution_minutes numeric,
  avg_rating numeric,
  rating_count integer
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  -- Korak 1: provera uloge i perioda.
  select b.range_start, b.range_end into v_start, v_end
  from public.analytics_bounds(p_from, p_to) b;

  -- Korak 2: brojevi po agentu (podupiti), pa filtriranje praznih redova.
  return query
  select s.*
  from (
    select
      p.id as agent_id,
      p.full_name,
      p.role,
      p.is_active,
      (select count(*)::integer from public.tickets t
        where t.assigned_to = p.id
          and t.created_at >= v_start and t.created_at < v_end) as assigned_count,
      (select count(*)::integer from public.tickets t
        where t.assigned_to = p.id
          and t.resolved_at >= v_start and t.resolved_at < v_end) as resolved_count,
      (select round(avg(extract(epoch from (t.resolved_at - t.created_at)) / 60), 1)
        from public.tickets t
        where t.assigned_to = p.id
          and t.resolved_at >= v_start and t.resolved_at < v_end) as avg_resolution_minutes,
      (select round(avg(r.score), 2)
        from public.ticket_ratings r
        join public.tickets t on t.id = r.ticket_id
        where t.assigned_to = p.id
          and r.created_at >= v_start and r.created_at < v_end) as avg_rating,
      (select count(*)::integer
        from public.ticket_ratings r
        join public.tickets t on t.id = r.ticket_id
        where t.assigned_to = p.id
          and r.created_at >= v_start and r.created_at < v_end) as rating_count
    from public.profiles p
    where p.role in ('agent', 'admin')
  ) s
  where s.is_active or s.assigned_count > 0 or s.resolved_count > 0 or s.rating_count > 0
  order by s.resolved_count desc, s.full_name;
end;
$$;

-- Funkcija analytics_trend: broj kreiranih i rešenih zahteva po danu ili
-- nedelji (p_bucket = 'day' | 'week'; nedelja počinje ponedeljkom).
-- Vraća SVE dane/nedelje u periodu, i one bez zahteva (sa nulama), da
-- grafikon nema rupe. bucket_start je prvi dan dana/nedelje (beogradsko vreme).
-- Nepoznat p_bucket: VALIDATION_ERROR.
create function public.analytics_trend(p_from date, p_to date, p_bucket text)
returns table (bucket_start date, created_count integer, resolved_count integer)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  -- Korak 1: provera uloge, perioda i veličine intervala.
  select b.range_start, b.range_end into v_start, v_end
  from public.analytics_bounds(p_from, p_to) b;

  if p_bucket not in ('day', 'week') then
    raise exception using message = 'VALIDATION_ERROR', errcode = 'P0001';
  end if;

  -- Korak 2: niz svih dana/nedelja u periodu, spojen sa brojevima.
  return query
  with buckets as (
    select g::date as bucket_start
    from generate_series(
      date_trunc(p_bucket, p_from::timestamp),
      date_trunc(p_bucket, p_to::timestamp),
      ('1 ' || p_bucket)::interval
    ) as g
  ),
  created as (
    select date_trunc(p_bucket, t.created_at at time zone 'Europe/Belgrade')::date as b,
      count(*)::integer as total
    from public.tickets t
    where t.created_at >= v_start and t.created_at < v_end
    group by 1
  ),
  resolved as (
    select date_trunc(p_bucket, t.resolved_at at time zone 'Europe/Belgrade')::date as b,
      count(*)::integer as total
    from public.tickets t
    where t.resolved_at >= v_start and t.resolved_at < v_end
    group by 1
  )
  select
    k.bucket_start,
    coalesce(c.total, 0) as created_count,
    coalesce(r.total, 0) as resolved_count
  from buckets k
  left join created c on c.b = k.bucket_start
  left join resolved r on r.b = k.bucket_start
  order by k.bucket_start;
end;
$$;

-- Prava izvršavanja: samo prijavljeni (ulogu admin funkcije proveravaju same).
revoke execute on function public.analytics_bounds(date, date) from public, anon;
revoke execute on function public.analytics_overview(date, date) from public, anon;
revoke execute on function public.analytics_by_dimension(date, date, text) from public, anon;
revoke execute on function public.analytics_agents(date, date) from public, anon;
revoke execute on function public.analytics_trend(date, date, text) from public, anon;
grant execute on function public.analytics_bounds(date, date) to authenticated;
grant execute on function public.analytics_overview(date, date) to authenticated;
grant execute on function public.analytics_by_dimension(date, date, text) to authenticated;
grant execute on function public.analytics_agents(date, date) to authenticated;
grant execute on function public.analytics_trend(date, date, text) to authenticated;
