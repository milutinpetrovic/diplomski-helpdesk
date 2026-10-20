-- =============================================================================
-- Migracija 8: RPC funkcije za rad sa zahtevima i korisnicima
--
-- Šta je ovde:
--   A) interne pomoćne funkcije u šemi `private`:
--      require_active_role, lock_visible_ticket, log_history, notify,
--      is_status_transition_allowed, apply_status_change
--   B) javne RPC funkcije koje poziva servisni sloj (TypeScript):
--      create_ticket, update_ticket, add_comment, assign_ticket,
--      change_ticket_status, rate_ticket, admin_update_user
--
-- Zašto RPC: svaka funkcija radi sve u JEDNOJ transakciji (promena + istorija
-- + obaveštenja), pa nikad ne ostane pola posla. Sve su `security definer`
-- (izvršavaju se kao vlasnik baze, jer upisuju u tabele u koje korisnik nema
-- pravo upisa, npr. tuđa obaveštenja), zato SVAKA na početku sama proverava
-- ko je pozivalac (auth.uid()), njegovu ulogu i pristup zahtevu.
--
-- Greške: raise exception using message = '<KOD>', errcode = 'P0001'.
-- Kodovi su isti kao u API-ju (docs/06-api-i-stranice.md, sekcija 1):
--   UNAUTHENTICATED, ACCOUNT_DISABLED, FORBIDDEN, VALIDATION_ERROR,
--   NOT_FOUND, TICKET_NOT_FOUND, NOT_ASSIGNED_AGENT, FORBIDDEN_INTERNAL_COMMENT,
--   INVALID_STATUS_TRANSITION, TICKET_ALREADY_ASSIGNED, ASSIGNEE_NOT_AGENT,
--   TICKET_CLOSED, TICKET_NOT_RESOLVED, ALREADY_RATED, CANNOT_MODIFY_SELF
--
-- Dokumentacija: docs/02-baza-podataka.md (sekcije 4 i 5) i
-- docs/07-uputstvo-za-implementaciju.md (Faza 2, tabela RPC funkcija).
-- =============================================================================


-- =============================================================================
-- A) Interne pomoćne funkcije (šema private, nisu dostupne kroz API)
-- =============================================================================

-- Funkcija require_active_role: vraća ulogu prijavljenog korisnika ili prekida
-- izvršavanje greškom:
--   UNAUTHENTICATED  - niko nije prijavljen
--   ACCOUNT_DISABLED - nalog je deaktiviran (ili nema profil)
create function private.require_active_role()
returns public.user_role
language plpgsql
stable
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  -- Korak 1: mora postojati prijavljen korisnik.
  if auth.uid() is null then
    raise exception using message = 'UNAUTHENTICATED', errcode = 'P0001';
  end if;

  -- Korak 2: nalog mora biti aktivan (current_user_role vraća null za neaktivne).
  v_role := public.current_user_role();
  if v_role is null then
    raise exception using message = 'ACCOUNT_DISABLED', errcode = 'P0001';
  end if;

  return v_role;
end;
$$;

-- Funkcija lock_visible_ticket: učitava zahtev i zaključava njegov red
-- (FOR UPDATE) do kraja transakcije, da dve istovremene izmene ne bi pregazile
-- jedna drugu. Ako zahtev ne postoji ILI ga pozivalac ne sme videti, vraća
-- TICKET_NOT_FOUND (namerno isto, da se ne otkrije da tuđi zahtev postoji).
create function private.lock_visible_ticket(p_ticket_id uuid)
returns public.tickets
language plpgsql
set search_path = ''
as $$
declare
  v_ticket public.tickets;
begin
  select * into v_ticket
  from public.tickets t
  where t.id = p_ticket_id
  for update;

  if not found or not public.can_view_ticket(p_ticket_id) then
    raise exception using message = 'TICKET_NOT_FOUND', errcode = 'P0001';
  end if;

  return v_ticket;
end;
$$;

-- Funkcija log_history: upisuje jednu stavku u istoriju zahteva.
-- p_actor_id = null znači da je promenu izvršio sistem.
create function private.log_history(
  p_ticket_id uuid,
  p_actor_id uuid,
  p_action public.history_action,
  p_old_value jsonb,
  p_new_value jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into public.ticket_history (ticket_id, actor_id, action, old_value, new_value)
  values (p_ticket_id, p_actor_id, p_action, p_old_value, p_new_value);
$$;

-- Funkcija notify: pravi obaveštenje za jednog primaoca. Preskače:
--   - kad primalac ne postoji (npr. zahtev nema dodeljenog agenta)
--   - kad je primalac isti kao onaj ko je izazvao događaj (ne obaveštavamo
--     korisnika o njegovoj sopstvenoj akciji)
--   - kad je nalog primaoca deaktiviran
create function private.notify(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_ticket_id uuid,
  p_type public.notification_type
)
returns void
language sql
set search_path = ''
as $$
  insert into public.notifications (recipient_id, actor_id, ticket_id, type)
  select p.id, p_actor_id, p_ticket_id, p_type
  from public.profiles p
  where p.id = p_recipient_id
    and p.id is distinct from p_actor_id
    and p.is_active;
$$;

-- Funkcija is_status_transition_allowed: tabela dozvoljenih prelaza statusa
-- (docs/02, sekcija 4). Ista tabela postoji i u TypeScript-u
-- (src/services/tickets/status-transitions.ts) da bi UI znao koja dugmad
-- da prikaže; baza je poslednja linija odbrane.
--   admin    - svi prelazi iz tabele
--   agent    - samo na zahtevima koji su mu dodeljeni
--   customer - samo na svojim zahtevima: otkazivanje (open -> closed),
--              potvrda rešenja (resolved -> closed) i ponovno otvaranje
--              rešenog (resolved -> in_progress)
-- Prelaz open -> in_progress agent radi preuzimanjem (assign_ticket), a
-- automatski prelaz waiting_on_customer -> in_progress radi add_comment.
create function private.is_status_transition_allowed(
  p_role public.user_role,
  p_is_owner boolean,
  p_is_assignee boolean,
  p_from public.ticket_status,
  p_to public.ticket_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'admin' then
      (p_from::text || '>' || p_to::text) in (
        'open>in_progress',
        'open>closed',
        'in_progress>waiting_on_customer',
        'waiting_on_customer>in_progress',
        'in_progress>resolved',
        'waiting_on_customer>resolved',
        'resolved>closed',
        'resolved>in_progress',
        'closed>open'
      )
    when 'agent' then
      coalesce(p_is_assignee, false)
      and (p_from::text || '>' || p_to::text) in (
        'in_progress>waiting_on_customer',
        'waiting_on_customer>in_progress',
        'in_progress>resolved',
        'waiting_on_customer>resolved',
        'resolved>in_progress'
      )
    when 'customer' then
      coalesce(p_is_owner, false)
      and (p_from::text || '>' || p_to::text) in (
        'open>closed',
        'resolved>closed',
        'resolved>in_progress'
      )
    else false
  end;
$$;

-- Funkcija apply_status_change: izvršava promenu statusa (bez provere prava,
-- to radi pozivalac) i održava vremenske oznake:
--   - ulazak u resolved  -> resolved_at = sada
--   - ulazak u closed    -> closed_at = sada (resolved_at ostaje)
--   - povratak u rad (open, in_progress, waiting_on_customer) -> brišu se
--     resolved_at i closed_at
-- Zatim upisuje istoriju i (ako je p_notify) obaveštava vlasnika i
-- dodeljenog agenta, osim onoga ko je promenu izazvao.
--   p_actor_id         - ko je izazvao promenu (za obaveštenja)
--   p_history_actor_id - ko piše u istoriji (null = sistem, za automatske prelaze)
create function private.apply_status_change(
  p_ticket_id uuid,
  p_new_status public.ticket_status,
  p_actor_id uuid,
  p_history_actor_id uuid,
  p_notify boolean
)
returns public.tickets
language plpgsql
set search_path = ''
as $$
declare
  v_old_status public.ticket_status;
  v_ticket public.tickets;
begin
  -- Korak 1: trenutni status (red je već zaključan kod pozivaoca).
  select t.status into v_old_status from public.tickets t where t.id = p_ticket_id;

  -- Korak 2: novi status i vremenske oznake.
  update public.tickets t
  set
    status = p_new_status,
    resolved_at = case
      when p_new_status = 'resolved' then now()
      when p_new_status in ('open', 'in_progress', 'waiting_on_customer') then null
      else t.resolved_at
    end,
    closed_at = case
      when p_new_status = 'closed' then now()
      when p_new_status in ('open', 'in_progress', 'waiting_on_customer') then null
      else t.closed_at
    end
  where t.id = p_ticket_id
  returning t.* into v_ticket;

  -- Korak 3: istorija.
  perform private.log_history(
    p_ticket_id,
    p_history_actor_id,
    'status_changed',
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status)
  );

  -- Korak 4: obaveštenja vlasniku i dodeljenom agentu.
  if p_notify then
    perform private.notify(v_ticket.created_by, p_actor_id, p_ticket_id, 'status_changed');
    perform private.notify(v_ticket.assigned_to, p_actor_id, p_ticket_id, 'status_changed');
  end if;

  return v_ticket;
end;
$$;

-- Interne funkcije ne sme da pozove niko osim vlasnika baze (tj. RPC funkcija).
revoke all on function private.require_active_role() from public;
revoke all on function private.lock_visible_ticket(uuid) from public;
revoke all on function private.log_history(uuid, uuid, public.history_action, jsonb, jsonb) from public;
revoke all on function private.notify(uuid, uuid, uuid, public.notification_type) from public;
revoke all on function private.is_status_transition_allowed(public.user_role, boolean, boolean, public.ticket_status, public.ticket_status) from public;
revoke all on function private.apply_status_change(uuid, public.ticket_status, uuid, uuid, boolean) from public;


-- =============================================================================
-- B) Javne RPC funkcije (poziva ih servisni sloj: supabase.rpc('<naziv>', ...))
-- =============================================================================

-- RPC create_ticket (UC-09): korisnik kreira novi zahtev.
--   1. samo aktivan korisnik sa ulogom customer
--   2. provera naslova (5–150), opisa (10–5000) i aktivne kategorije
--   3. upis zahteva (status open, nedodeljen)
--   4. istorija `created`
--   5. obaveštenje `ticket_created` svim aktivnim agentima i adminima
create function public.create_ticket(
  p_title text,
  p_description text,
  p_category_id uuid,
  p_priority public.ticket_priority default 'medium'
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_ticket public.tickets;
begin
  -- Korak 1: uloga.
  v_role := private.require_active_role();
  if v_role <> 'customer' then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  -- Korak 2: provera ulaza (Zod je već proverio, ovo je zaštita baze).
  if char_length(trim(coalesce(p_title, ''))) not between 5 and 150
    or char_length(trim(coalesce(p_description, ''))) not between 10 and 5000
    or not exists (
      select 1 from public.categories c where c.id = p_category_id and c.is_active
    )
  then
    raise exception using message = 'VALIDATION_ERROR', errcode = 'P0001';
  end if;

  -- Korak 3: upis zahteva.
  insert into public.tickets (title, description, category_id, priority, created_by)
  values (trim(p_title), trim(p_description), p_category_id, coalesce(p_priority, 'medium'), v_uid)
  returning * into v_ticket;

  -- Korak 4: istorija.
  perform private.log_history(
    v_ticket.id,
    v_uid,
    'created',
    null,
    jsonb_build_object(
      'status', v_ticket.status,
      'priority', v_ticket.priority,
      'category_id', v_ticket.category_id
    )
  );

  -- Korak 5: obaveštenje celom timu podrške.
  insert into public.notifications (recipient_id, actor_id, ticket_id, type)
  select p.id, v_uid, v_ticket.id, 'ticket_created'
  from public.profiles p
  where p.role in ('agent', 'admin')
    and p.is_active;

  return v_ticket;
end;
$$;

-- RPC update_ticket (PATCH /api/tickets/{id}): izmena naslova, opisa,
-- kategorije i prioriteta. Parametar null = to polje se ne menja.
--   - zatvoren zahtev se ne menja (TICKET_CLOSED)
--   - korisnik (vlasnik): samo naslov i opis, i to dok je zahtev `open`
--   - agent: samo zahtev koji mu je dodeljen (NOT_ASSIGNED_AGENT)
--   - admin: svaki zahtev
-- Istorija: `updated` (spisak promenjenih polja), `priority_changed`,
-- `category_changed`.
create function public.update_ticket(
  p_ticket_id uuid,
  p_title text default null,
  p_description text default null,
  p_category_id uuid default null,
  p_priority public.ticket_priority default null
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_old public.tickets;
  v_new public.tickets;
  v_fields text[] := '{}';
begin
  -- Korak 1: uloga i pristup zahtevu (zaključava red).
  v_role := private.require_active_role();
  v_old := private.lock_visible_ticket(p_ticket_id);

  -- Korak 2: pravila po ulozi.
  if v_old.status = 'closed' then
    raise exception using message = 'TICKET_CLOSED', errcode = 'P0001';
  end if;

  if v_role = 'customer' then
    if v_old.created_by <> v_uid
      or v_old.status <> 'open'
      or (p_category_id is not null and p_category_id <> v_old.category_id)
      or (p_priority is not null and p_priority <> v_old.priority)
    then
      raise exception using message = 'FORBIDDEN', errcode = 'P0001';
    end if;
  elsif v_role = 'agent' and v_old.assigned_to is distinct from v_uid then
    raise exception using message = 'NOT_ASSIGNED_AGENT', errcode = 'P0001';
  end if;

  -- Korak 3: provera ulaza.
  if (p_title is not null and char_length(trim(p_title)) not between 5 and 150)
    or (p_description is not null and char_length(trim(p_description)) not between 10 and 5000)
    or (
      p_category_id is not null
      and p_category_id <> v_old.category_id
      and not exists (
        select 1 from public.categories c where c.id = p_category_id and c.is_active
      )
    )
  then
    raise exception using message = 'VALIDATION_ERROR', errcode = 'P0001';
  end if;

  -- Korak 4: izmena (null znači "ostavi staru vrednost").
  update public.tickets t
  set
    title = coalesce(trim(p_title), t.title),
    description = coalesce(trim(p_description), t.description),
    category_id = coalesce(p_category_id, t.category_id),
    priority = coalesce(p_priority, t.priority)
  where t.id = p_ticket_id
  returning t.* into v_new;

  -- Korak 5: istorija, samo za polja koja su se zaista promenila.
  if v_new.title <> v_old.title then
    v_fields := array_append(v_fields, 'title');
  end if;
  if v_new.description <> v_old.description then
    v_fields := array_append(v_fields, 'description');
  end if;
  if cardinality(v_fields) > 0 then
    perform private.log_history(
      p_ticket_id, v_uid, 'updated', null, jsonb_build_object('fields', to_jsonb(v_fields))
    );
  end if;

  if v_new.priority <> v_old.priority then
    perform private.log_history(
      p_ticket_id,
      v_uid,
      'priority_changed',
      jsonb_build_object('priority', v_old.priority),
      jsonb_build_object('priority', v_new.priority)
    );
  end if;

  if v_new.category_id <> v_old.category_id then
    perform private.log_history(
      p_ticket_id,
      v_uid,
      'category_changed',
      jsonb_build_object('category_id', v_old.category_id),
      jsonb_build_object('category_id', v_new.category_id)
    );
  end if;

  return v_new;
end;
$$;

-- RPC add_comment (UC-12, UC-18): novi komentar na zahtevu.
--   1. pristup zahtevu (TICKET_NOT_FOUND), zatvoren zahtev (TICKET_CLOSED)
--   2. internu belešku piše samo agent/admin (FORBIDDEN_INTERNAL_COMMENT)
--   3. upis komentara (1–5000 karaktera)
--   4. prvi javni odgovor agenta/admina upisuje first_response_at (samo jednom)
--   5. kad vlasnik odgovori na zahtev koji čeka njega (waiting_on_customer),
--      status automatski prelazi u in_progress (u istoriji kao sistem)
--   6. obaveštenja: javni komentar -> vlasnik i dodeljeni agent;
--      interna beleška -> samo dodeljeni agent (vlasnik nikad)
create function public.add_comment(
  p_ticket_id uuid,
  p_body text,
  p_is_internal boolean default false
)
returns public.ticket_comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_ticket public.tickets;
  v_is_internal boolean := coalesce(p_is_internal, false);
  v_comment public.ticket_comments;
begin
  -- Korak 1: uloga, pristup i status zahteva.
  v_role := private.require_active_role();
  v_ticket := private.lock_visible_ticket(p_ticket_id);

  if v_ticket.status = 'closed' then
    raise exception using message = 'TICKET_CLOSED', errcode = 'P0001';
  end if;

  -- Korak 2: interne beleške samo za tim podrške.
  if v_is_internal and v_role = 'customer' then
    raise exception using message = 'FORBIDDEN_INTERNAL_COMMENT', errcode = 'P0001';
  end if;

  -- Korak 3: provera teksta i upis komentara.
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception using message = 'VALIDATION_ERROR', errcode = 'P0001';
  end if;

  insert into public.ticket_comments (ticket_id, author_id, body, is_internal)
  values (p_ticket_id, v_uid, trim(p_body), v_is_internal)
  returning * into v_comment;

  -- Korak 4: vreme prvog odgovora tima podrške (za analitiku).
  if v_role in ('agent', 'admin')
    and not v_is_internal
    and v_ticket.first_response_at is null
    and v_ticket.created_by <> v_uid
  then
    update public.tickets t set first_response_at = now() where t.id = p_ticket_id;
  end if;

  -- Korak 5: automatski povratak u obradu kad vlasnik odgovori.
  if v_ticket.created_by = v_uid
    and not v_is_internal
    and v_ticket.status = 'waiting_on_customer'
  then
    perform private.apply_status_change(p_ticket_id, 'in_progress', v_uid, null, false);
  end if;

  -- Korak 6: obaveštenja (notify preskače autora komentara).
  if v_is_internal then
    perform private.notify(v_ticket.assigned_to, v_uid, p_ticket_id, 'internal_comment_added');
  else
    perform private.notify(v_ticket.created_by, v_uid, p_ticket_id, 'comment_added');
    perform private.notify(v_ticket.assigned_to, v_uid, p_ticket_id, 'comment_added');
  end if;

  return v_comment;
end;
$$;

-- RPC assign_ticket (UC-16 preuzimanje, UC-20 dodela).
-- p_assignee_id: ID agenta/admina kome se zahtev dodeljuje; ako se izostavi
-- (null), zahtev se oslobađa (samo admin).
--   - agent sme samo sebi da dodeli zahtev, i to samo nedodeljen
--     (TICKET_ALREADY_ASSIGNED ako ga je već preuzeo neko drugi)
--   - admin dodeljuje bilo kom aktivnom agentu/adminu (ASSIGNEE_NOT_AGENT
--     ako izabrani nije član tima), ili oslobađa zahtev (p_assignee_id = null)
--   - zatvoren zahtev se ne dodeljuje (TICKET_CLOSED)
--   - dodela otvorenog zahteva ga prebacuje u in_progress; oslobađanje
--     zahteva koji je u radu vraća ga u open (nazad u red čekanja)
--   - istorija `assigned` / `unassigned`, obaveštenje `ticket_assigned` novom agentu
create function public.assign_ticket(
  p_ticket_id uuid,
  p_assignee_id uuid default null
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_ticket public.tickets;
begin
  -- Korak 1: samo tim podrške.
  v_role := private.require_active_role();
  if v_role not in ('agent', 'admin') then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  -- Korak 2: zahtev (zaključan) i njegovo stanje.
  v_ticket := private.lock_visible_ticket(p_ticket_id);
  if v_ticket.status = 'closed' then
    raise exception using message = 'TICKET_CLOSED', errcode = 'P0001';
  end if;

  -- Korak 3: pravila za agenta (samo preuzimanje za sebe).
  if v_role = 'agent' then
    if p_assignee_id is distinct from v_uid then
      raise exception using message = 'FORBIDDEN', errcode = 'P0001';
    end if;
    if v_ticket.assigned_to is not null and v_ticket.assigned_to <> v_uid then
      raise exception using message = 'TICKET_ALREADY_ASSIGNED', errcode = 'P0001';
    end if;
  end if;

  -- Korak 4: izabrani mora biti aktivan agent ili admin.
  if p_assignee_id is not null and not exists (
    select 1
    from public.profiles p
    where p.id = p_assignee_id
      and p.role in ('agent', 'admin')
      and p.is_active
  ) then
    raise exception using message = 'ASSIGNEE_NOT_AGENT', errcode = 'P0001';
  end if;

  -- Korak 5: ako se ništa ne menja, vraćamo zahtev bez upisa.
  if v_ticket.assigned_to is not distinct from p_assignee_id then
    return v_ticket;
  end if;

  -- Korak 6: dodela i istorija.
  update public.tickets t set assigned_to = p_assignee_id where t.id = p_ticket_id;

  if p_assignee_id is null then
    perform private.log_history(
      p_ticket_id, v_uid, 'unassigned', jsonb_build_object('assigned_to', v_ticket.assigned_to), null
    );
  else
    perform private.log_history(
      p_ticket_id,
      v_uid,
      'assigned',
      jsonb_build_object('assigned_to', v_ticket.assigned_to),
      jsonb_build_object('assigned_to', p_assignee_id)
    );
    perform private.notify(p_assignee_id, v_uid, p_ticket_id, 'ticket_assigned');
  end if;

  -- Korak 7: usklađivanje statusa sa dodelom. Obaveštenje o promeni statusa
  -- ide samo vlasniku (agent je već dobio `ticket_assigned`).
  if p_assignee_id is not null and v_ticket.status = 'open' then
    perform private.apply_status_change(p_ticket_id, 'in_progress', v_uid, v_uid, false);
    perform private.notify(v_ticket.created_by, v_uid, p_ticket_id, 'status_changed');
  elsif p_assignee_id is null and v_ticket.status in ('in_progress', 'waiting_on_customer') then
    perform private.apply_status_change(p_ticket_id, 'open', v_uid, v_uid, false);
    perform private.notify(v_ticket.created_by, v_uid, p_ticket_id, 'status_changed');
  end if;

  select * into v_ticket from public.tickets t where t.id = p_ticket_id;
  return v_ticket;
end;
$$;

-- RPC change_ticket_status (UC-13, UC-17): ručna promena statusa.
--   1. pristup zahtevu (TICKET_NOT_FOUND)
--   2. agent menja samo zahteve koji su mu dodeljeni (NOT_ASSIGNED_AGENT)
--   3. prelaz mora biti u tabeli dozvoljenih (INVALID_STATUS_TRANSITION)
--   4. promena + vremenske oznake + istorija + obaveštenja (apply_status_change)
create function public.change_ticket_status(
  p_ticket_id uuid,
  p_new_status public.ticket_status
)
returns public.tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_ticket public.tickets;
begin
  -- Korak 1: uloga i pristup.
  v_role := private.require_active_role();
  v_ticket := private.lock_visible_ticket(p_ticket_id);

  if p_new_status is null then
    raise exception using message = 'VALIDATION_ERROR', errcode = 'P0001';
  end if;

  -- Korak 2: agent mora biti dodeljen.
  if v_role = 'agent' and v_ticket.assigned_to is distinct from v_uid then
    raise exception using message = 'NOT_ASSIGNED_AGENT', errcode = 'P0001';
  end if;

  -- Korak 3: tabela prelaza.
  if not private.is_status_transition_allowed(
    v_role,
    v_ticket.created_by = v_uid,
    v_ticket.assigned_to is not distinct from v_uid,
    v_ticket.status,
    p_new_status
  ) then
    raise exception using message = 'INVALID_STATUS_TRANSITION', errcode = 'P0001';
  end if;

  -- Korak 4: izvršenje promene.
  return private.apply_status_change(p_ticket_id, p_new_status, v_uid, v_uid, true);
end;
$$;

-- RPC rate_ticket (UC-14): vlasnik ocenjuje rešen zahtev (CSAT 1–5).
--   1. samo vlasnik zahteva (FORBIDDEN)
--   2. zahtev mora biti resolved ili closed (TICKET_NOT_RESOLVED)
--   3. najviše jedna ocena (ALREADY_RATED)
--   4. upis ocene, istorija `rated`, obaveštenje dodeljenom agentu
create function public.rate_ticket(
  p_ticket_id uuid,
  p_score integer,
  p_comment text default null
)
returns public.ticket_ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ticket public.tickets;
  v_rating public.ticket_ratings;
begin
  -- Korak 1: uloga, pristup i vlasništvo.
  perform private.require_active_role();
  v_ticket := private.lock_visible_ticket(p_ticket_id);

  if v_ticket.created_by <> v_uid then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  -- Korak 2 i 3: stanje zahteva.
  if v_ticket.status not in ('resolved', 'closed') then
    raise exception using message = 'TICKET_NOT_RESOLVED', errcode = 'P0001';
  end if;

  if exists (select 1 from public.ticket_ratings r where r.ticket_id = p_ticket_id) then
    raise exception using message = 'ALREADY_RATED', errcode = 'P0001';
  end if;

  -- Korak 4: provera ulaza i upis.
  if p_score is null
    or p_score not between 1 and 5
    or char_length(coalesce(p_comment, '')) > 1000
  then
    raise exception using message = 'VALIDATION_ERROR', errcode = 'P0001';
  end if;

  insert into public.ticket_ratings (ticket_id, rated_by, score, comment)
  values (p_ticket_id, v_uid, p_score, nullif(trim(p_comment), ''))
  returning * into v_rating;

  perform private.log_history(p_ticket_id, v_uid, 'rated', null, jsonb_build_object('score', p_score));
  perform private.notify(v_ticket.assigned_to, v_uid, p_ticket_id, 'ticket_rated');

  return v_rating;
end;
$$;

-- RPC admin_update_user (UC-21): admin menja ulogu i/ili aktivnost naloga.
--   1. samo admin (FORBIDDEN), ne sme sebe (CANNOT_MODIFY_SELF), korisnik
--      mora postojati (NOT_FOUND)
--   2. izmena uloge i/ili is_active (null = bez promene)
--   3. kad agent/admin izgubi ulogu tima ili bude deaktiviran, njegovi
--      nerešeni zahtevi se oslobađaju (istorija `unassigned`) i vraćaju u
--      red čekanja (status open), da ne bi ostali "zaglavljeni"
create function public.admin_update_user(
  p_user_id uuid,
  p_role public.user_role default null,
  p_is_active boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.profiles;
  v_new public.profiles;
  v_ticket public.tickets;
begin
  -- Korak 1: provere.
  if private.require_active_role() <> 'admin' then
    raise exception using message = 'FORBIDDEN', errcode = 'P0001';
  end if;

  if p_user_id = v_uid then
    raise exception using message = 'CANNOT_MODIFY_SELF', errcode = 'P0001';
  end if;

  select * into v_old from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception using message = 'NOT_FOUND', errcode = 'P0001';
  end if;

  -- Korak 2: izmena.
  update public.profiles p
  set
    role = coalesce(p_role, p.role),
    is_active = coalesce(p_is_active, p.is_active)
  where p.id = p_user_id
  returning p.* into v_new;

  -- Korak 3: oslobađanje zahteva bivšeg člana tima.
  if v_old.role in ('agent', 'admin') and (v_new.role = 'customer' or not v_new.is_active) then
    for v_ticket in
      select *
      from public.tickets t
      where t.assigned_to = p_user_id
        and t.status not in ('resolved', 'closed')
      for update
    loop
      update public.tickets t set assigned_to = null where t.id = v_ticket.id;
      perform private.log_history(
        v_ticket.id, v_uid, 'unassigned', jsonb_build_object('assigned_to', p_user_id), null
      );
      if v_ticket.status in ('in_progress', 'waiting_on_customer') then
        perform private.apply_status_change(v_ticket.id, 'open', v_uid, v_uid, true);
      end if;
    end loop;
  end if;

  return v_new;
end;
$$;

-- Prava izvršavanja RPC funkcija: samo prijavljeni korisnici (gost ne).
-- Uloge i pristup svaka funkcija proverava sama, iznad.
revoke execute on function public.create_ticket(text, text, uuid, public.ticket_priority) from public, anon;
revoke execute on function public.update_ticket(uuid, text, text, uuid, public.ticket_priority) from public, anon;
revoke execute on function public.add_comment(uuid, text, boolean) from public, anon;
revoke execute on function public.assign_ticket(uuid, uuid) from public, anon;
revoke execute on function public.change_ticket_status(uuid, public.ticket_status) from public, anon;
revoke execute on function public.rate_ticket(uuid, integer, text) from public, anon;
revoke execute on function public.admin_update_user(uuid, public.user_role, boolean) from public, anon;

grant execute on function public.create_ticket(text, text, uuid, public.ticket_priority) to authenticated;
grant execute on function public.update_ticket(uuid, text, text, uuid, public.ticket_priority) to authenticated;
grant execute on function public.add_comment(uuid, text, boolean) to authenticated;
grant execute on function public.assign_ticket(uuid, uuid) to authenticated;
grant execute on function public.change_ticket_status(uuid, public.ticket_status) to authenticated;
grant execute on function public.rate_ticket(uuid, integer, text) to authenticated;
grant execute on function public.admin_update_user(uuid, public.user_role, boolean) to authenticated;
