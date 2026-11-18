-- CADARS Live: coverage reports, club diary, and committee approval.
-- Idempotent. Run the whole file once in the Supabase SQL editor.
--
-- What it does:
-- 1. Adds members.status (pending / approved / rejected). Existing rows become approved.
--    New sign-ups default to pending.
-- 2. Allows members.role 'admin' as well as member, controller, and committee.
-- 3. Requires a member callsign to be a UK amateur format, stored in capitals.
-- 4. Stops a member promoting themselves. A before-trigger freezes role and status
--    on your own row. Committee or admin can change other members. The SQL editor
--    (no auth.uid()) can still set the first admin.
-- 5. Scrubs phone numbers and UK postcodes from names, events, repeater text, and
--    signal reports. Existing event and repeater text is scrubbed once.
-- 6. Rounds coverage_reports lat/lng to 3 decimal places (about 100 m).
-- 7. Replaces RLS:
--      anyone can read every table;
--      only an approved member can insert nets, checkins, on_air, and coverage_reports;
--      on_air and coverage reports must use your own callsign;
--      you can delete your own on_air rows;
--      only committee or admin can write events and repeaters;
--      you can insert your own members row as a pending member, and edit your own
--      callsign and name; committee or admin can update other members.
-- 8. Helper functions live in schema private (not the Data API), security definer,
--    search_path empty, so policies do not recurse through members RLS.
-- 9. Marks auth.users email m1k3build@gmail.com as an approved admin. If that
--    account has no members row, it creates one with callsign M7TGM and name Mike.
--    An existing callsign and name are left as they are.
-- 10. Makes on_air_current a security invoker view so it follows on_air RLS.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to anon;
grant usage on schema private to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema private to service_role;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- members.status, role, and callsign rules
-- ---------------------------------------------------------------------------

alter table public.members add column if not exists status text;

update public.members
set status = 'approved'
where status is null;

alter table public.members alter column status set default 'pending';
alter table public.members alter column status set not null;

alter table public.members drop constraint if exists members_status_check;
alter table public.members
  add constraint members_status_check
  check (status in ('pending', 'approved', 'rejected'));

do $$
declare
  con record;
begin
  for con in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.members'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
      and c.conname <> 'members_status_check'
  loop
    execute format('alter table public.members drop constraint %I', con.conname);
  end loop;
end
$$;

alter table public.members drop constraint if exists members_role_check;
alter table public.members
  add constraint members_role_check
  check (role in ('member', 'controller', 'committee', 'admin'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.members'::regclass
      and contype in ('u', 'p')
      and pg_get_constraintdef(oid) ilike '%(user_id)%'
  ) then
    alter table public.members add constraint members_user_id_key unique (user_id);
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Text scrub and approval helpers
-- ---------------------------------------------------------------------------

create or replace function private.scrub_contact(value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text;
begin
  if value is null then
    return null;
  end if;
  cleaned := regexp_replace(value, '\+?[0-9][0-9[:space:]()+-]{8,}[0-9]', '', 'g');
  cleaned := regexp_replace(
    cleaned,
    '\m[A-Z]{1,2}[0-9][A-Z0-9]?[[:space:]]*[0-9][A-Z]{2}\M',
    '',
    'gi'
  );
  cleaned := regexp_replace(cleaned, '[[:space:]]+,', ',', 'g');
  cleaned := regexp_replace(cleaned, ',[[:space:]]*,', ', ', 'g');
  cleaned := regexp_replace(cleaned, '[[:space:]]{2,}', ' ', 'g');
  cleaned := btrim(cleaned, ' ,');
  if cleaned = '' then
    return null;
  end if;
  return cleaned;
end;
$$;

create or replace function private.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.user_id = (select auth.uid())
      and m.status = 'approved'
  );
$$;

create or replace function private.is_committee()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.user_id = (select auth.uid())
      and m.status = 'approved'
      and m.role in ('committee', 'admin')
  );
$$;

create or replace function private.my_callsign()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.callsign
  from public.members m
  where m.user_id = (select auth.uid())
    and m.status = 'approved'
  limit 1;
$$;

create or replace function private.protect_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.callsign is not null then
    new.callsign := upper(btrim(new.callsign));
  end if;
  new.display_name := private.scrub_contact(new.display_name);

  if tg_op = 'INSERT' and (select auth.uid()) is not null then
    -- A signed-in person can only create their own pending member row.
    new.user_id := (select auth.uid());
    new.role := 'member';
    new.status := 'pending';
  elsif tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
    if (select auth.uid()) is null then
      -- SQL editor and service role: the seed below sets the first admin here.
      null;
    elsif old.user_id = (select auth.uid()) or not private.is_committee() then
      -- Your own row, or anyone who is not committee: callsign and name only.
      new.user_id := old.user_id;
      new.role := old.role;
      new.status := old.status;
    else
      -- Committee or admin, editing somebody else.
      new.user_id := old.user_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.clean_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.title := private.scrub_contact(new.title);
  new.location := private.scrub_contact(new.location);
  new.description := private.scrub_contact(new.description);
  if new.title is null then
    raise exception 'An event needs a title.';
  end if;
  return new;
end;
$$;

create or replace function private.clean_repeater()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.callsign is not null then
    new.callsign := upper(btrim(new.callsign));
  end if;
  new.location := private.scrub_contact(new.location);
  new.notes := private.scrub_contact(new.notes);
  return new;
end;
$$;

create or replace function private.round_coverage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lat is null or new.lng is null then
    raise exception 'A coverage report needs a spot on the map.';
  end if;
  new.lat := round(new.lat::numeric, 3)::double precision;
  new.lng := round(new.lng::numeric, 3)::double precision;
  if new.lat < -90 or new.lat > 90 or new.lng < -180 or new.lng > 180 then
    raise exception 'That spot is not a valid position.';
  end if;
  if new.callsign is not null then
    new.callsign := upper(btrim(new.callsign));
  end if;
  if new.repeater is not null then
    new.repeater := upper(btrim(new.repeater));
  end if;
  new.signal_report := left(private.scrub_contact(new.signal_report), 40);
  return new;
end;
$$;

create or replace function private.upper_callsign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.callsign is not null then
    new.callsign := upper(btrim(new.callsign));
  end if;
  return new;
end;
$$;

create or replace function private.upper_controller()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.controller_callsign is not null then
    new.controller_callsign := upper(btrim(new.controller_callsign));
  end if;
  return new;
end;
$$;

revoke all on function private.scrub_contact(text) from public, anon, authenticated;
revoke all on function private.is_approved() from public, anon;
revoke all on function private.is_committee() from public, anon;
revoke all on function private.my_callsign() from public, anon;
revoke all on function private.protect_member() from public;
revoke all on function private.clean_event() from public;
revoke all on function private.clean_repeater() from public;
revoke all on function private.round_coverage() from public;
revoke all on function private.upper_callsign() from public;
revoke all on function private.upper_controller() from public;

grant execute on function private.is_approved() to authenticated;
grant execute on function private.is_committee() to authenticated;
grant execute on function private.my_callsign() to authenticated;
grant execute on function private.protect_member() to anon, authenticated;
grant execute on function private.clean_event() to anon, authenticated;
grant execute on function private.clean_repeater() to anon, authenticated;
grant execute on function private.round_coverage() to anon, authenticated;
grant execute on function private.upper_callsign() to anon, authenticated;
grant execute on function private.upper_controller() to anon, authenticated;

drop trigger if exists members_guard on public.members;
create trigger members_guard
before insert or update on public.members
for each row execute function private.protect_member();

drop trigger if exists events_scrub on public.events;
create trigger events_scrub
before insert or update on public.events
for each row execute function private.clean_event();

drop trigger if exists repeaters_scrub on public.repeaters;
create trigger repeaters_scrub
before insert or update on public.repeaters
for each row execute function private.clean_repeater();

drop trigger if exists coverage_round on public.coverage_reports;
create trigger coverage_round
before insert or update on public.coverage_reports
for each row execute function private.round_coverage();

drop trigger if exists on_air_upper on public.on_air;
create trigger on_air_upper
before insert or update on public.on_air
for each row execute function private.upper_callsign();

drop trigger if exists checkins_upper on public.checkins;
create trigger checkins_upper
before insert or update on public.checkins
for each row execute function private.upper_callsign();

drop trigger if exists nets_upper on public.nets;
create trigger nets_upper
before insert or update on public.nets
for each row execute function private.upper_controller();

do $$
declare
  bad text;
begin
  select string_agg(callsign, ', ' order by callsign)
  into bad
  from public.members
  where callsign !~ '^((G|GM|GW|GI|GD|GJ|GU)[0-9][A-Z]{2,3}|(M|MM|MW|MI|MD|MJ|MU)[013567][A-Z]{3}|2[EWMIDUJ][01][A-Z]{3})$';
  if bad is not null then
    raise exception 'members.callsign is not a UK amateur callsign: %', bad;
  end if;
end
$$;

alter table public.members drop constraint if exists members_callsign_format;
alter table public.members
  add constraint members_callsign_format
  check (
    callsign ~ '^((G|GM|GW|GI|GD|GJ|GU)[0-9][A-Z]{2,3}|(M|MM|MW|MI|MD|MJ|MU)[013567][A-Z]{3}|2[EWMIDUJ][01][A-Z]{3})$'
  );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'members',
        'nets',
        'checkins',
        'on_air',
        'coverage_reports',
        'repeaters',
        'events'
      )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end
$$;

alter table public.members enable row level security;
alter table public.nets enable row level security;
alter table public.checkins enable row level security;
alter table public.on_air enable row level security;
alter table public.coverage_reports enable row level security;
alter table public.repeaters enable row level security;
alter table public.events enable row level security;

create policy members_read on public.members
for select to anon, authenticated
using (true);

create policy members_insert_own on public.members
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and status = 'pending'
);

create policy members_update on public.members
for update to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_committee())
)
with check (
  user_id = (select auth.uid())
  or (select private.is_committee())
);

create policy nets_read on public.nets
for select to anon, authenticated
using (true);

create policy nets_insert_approved on public.nets
for insert to authenticated
with check (
  (select private.is_approved())
  and upper(controller_callsign) = (select private.my_callsign())
);

create policy checkins_read on public.checkins
for select to anon, authenticated
using (true);

create policy checkins_insert_approved on public.checkins
for insert to authenticated
with check ((select private.is_approved()));

create policy on_air_read on public.on_air
for select to anon, authenticated
using (true);

create policy on_air_insert_own on public.on_air
for insert to authenticated
with check (
  (select private.is_approved())
  and upper(callsign) = (select private.my_callsign())
);

create policy on_air_delete_own on public.on_air
for delete to authenticated
using (
  (select private.is_approved())
  and upper(callsign) = (select private.my_callsign())
);

create policy coverage_read on public.coverage_reports
for select to anon, authenticated
using (true);

create policy coverage_insert_own on public.coverage_reports
for insert to authenticated
with check (
  (select private.is_approved())
  and upper(callsign) = (select private.my_callsign())
  and lat between -90 and 90
  and lng between -180 and 180
);

create policy repeaters_read on public.repeaters
for select to anon, authenticated
using (true);

create policy repeaters_insert_committee on public.repeaters
for insert to authenticated
with check ((select private.is_committee()));

create policy repeaters_update_committee on public.repeaters
for update to authenticated
using ((select private.is_committee()))
with check ((select private.is_committee()));

create policy repeaters_delete_committee on public.repeaters
for delete to authenticated
using ((select private.is_committee()));

create policy events_read on public.events
for select to anon, authenticated
using (true);

create policy events_insert_committee on public.events
for insert to authenticated
with check ((select private.is_committee()));

create policy events_update_committee on public.events
for update to authenticated
using ((select private.is_committee()))
with check ((select private.is_committee()));

create policy events_delete_committee on public.events
for delete to authenticated
using ((select private.is_committee()));

grant select on
  public.members,
  public.nets,
  public.checkins,
  public.on_air,
  public.coverage_reports,
  public.repeaters,
  public.events
to anon, authenticated;

grant insert on
  public.members,
  public.nets,
  public.checkins,
  public.on_air,
  public.coverage_reports
to authenticated;

grant insert, update, delete on public.events, public.repeaters to authenticated;
grant update on public.members to authenticated;
grant delete on public.on_air to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'on_air_current'
      and c.relkind = 'v'
  ) then
    execute 'alter view public.on_air_current set (security_invoker = true)';
    execute 'grant select on public.on_air_current to anon, authenticated';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- First admin. Existing callsign and display name are kept.
-- ---------------------------------------------------------------------------

do $$
declare
  uid uuid;
  existing_id uuid;
begin
  -- The SQL editor runs as the table owner, which bypasses RLS unless it is forced.
  begin
    perform set_config('row_security', 'off', true);
  exception
    when insufficient_privilege then
      null;
  end;

  update public.events
  set
    title = coalesce(private.scrub_contact(title), title),
    location = private.scrub_contact(location),
    description = private.scrub_contact(description);

  update public.repeaters
  set
    location = private.scrub_contact(location),
    notes = private.scrub_contact(notes);

  update public.members
  set display_name = private.scrub_contact(display_name)
  where display_name is not null
    and display_name is distinct from private.scrub_contact(display_name);

  select id
  into uid
  from auth.users
  where lower(email) = 'm1k3build@gmail.com'
  limit 1;

  if uid is null then
    raise notice 'm1k3build@gmail.com is not in auth.users yet. Admin seed skipped.';
    return;
  end if;

  select id into existing_id from public.members where user_id = uid;

  if existing_id is null then
    insert into public.members (user_id, callsign, display_name, role, status)
    values (uid, 'M7TGM', 'Mike', 'admin', 'approved');
  else
    update public.members
    set
      role = 'admin',
      status = 'approved',
      callsign = coalesce(nullif(btrim(callsign), ''), 'M7TGM'),
      display_name = coalesce(nullif(btrim(display_name), ''), 'Mike')
    where id = existing_id;
  end if;
end
$$;
