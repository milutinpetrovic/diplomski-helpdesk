-- =============================================================================
-- Migracija 9: dozvole za privatne real-time kanale (Realtime Authorization)
--
-- Kanali (broadcast) koje aplikacija koristi:
--   ticket:<id>  - osvežavanje otvorene stranice zahteva (novi komentar,
--                  promena statusa); sme onaj ko sme da vidi zahtev
--   staff        - osvežavanje liste zahteva za tim podrške; samo agent/admin
--   user:<id>    - lični kanal korisnika; samo taj korisnik
--
-- Poruke na kanalima nose samo ID-jeve ({ ticketId, event }); klijent posle
-- poruke ponovo učitava podatke kroz API, koji opet proverava prava.
-- Supabase Realtime pri pretplati/slanju proverava politike nad tabelom
-- realtime.messages; realtime.topic() vraća naziv kanala.
-- Dokumentacija: docs/02-baza-podataka.md, sekcija 7; CLAUDE.md, sekcija 5.
-- =============================================================================

-- Funkcija can_access_realtime_topic: da li prijavljeni (aktivan) korisnik
-- sme da sluša / šalje na kanal sa datim nazivom. Nepoznat oblik naziva = ne.
create function public.can_access_realtime_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Neprijavljen ili deaktiviran korisnik nema pristup nijednom kanalu.
  if public.current_user_role() is null then
    return false;
  end if;

  -- Kanal tima podrške.
  if p_topic = 'staff' then
    return public.is_staff();
  end if;

  -- Lični kanal: samo vlasnik.
  if p_topic = 'user:' || auth.uid()::text then
    return true;
  end if;

  -- Kanal zahteva: naziv mora biti ticket:<uuid>, a korisnik mora smeti da
  -- vidi zahtev.
  if p_topic ~ '^ticket:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return public.can_view_ticket(substr(p_topic, 8)::uuid);
  end if;

  return false;
end;
$$;

revoke execute on function public.can_access_realtime_topic(text) from public, anon;
grant execute on function public.can_access_realtime_topic(text) to authenticated;

-- Politika: pretplata (slušanje) na broadcast kanal samo uz dozvolu iznad.
create policy realtime_broadcast_select
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.can_access_realtime_topic(realtime.topic())
  );

-- Politika: slanje poruke na broadcast kanal (RealtimePublisher posle
-- uspešne izmene) samo uz istu dozvolu.
create policy realtime_broadcast_insert
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and public.can_access_realtime_topic(realtime.topic())
  );
