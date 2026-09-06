-- Fixes "infinite recursion detected in policy for relation event_participants"
-- (Postgres error 42P17). Run this in the Supabase SQL editor after 0001_init.sql.
--
-- Why this happened: `event_participants`'s owner policy checks `events`
-- (to see if you own the parent event), and `events`'s participant policy
-- checks `event_participants` (to see if your email is in it). Postgres has
-- to evaluate both policies to answer either question, which loops forever.
--
-- The fix: move each cross-table check into its own SECURITY DEFINER
-- function. Because these functions are owned by the same role that owns
-- the tables (the default in the SQL editor), Postgres exempts the table
-- owner from Row Level Security by default — so a query *inside* the
-- function reads the table directly, without re-triggering that table's
-- policies, breaking the cycle. The actual security checks themselves
-- (owner_id = auth.uid(), email = auth.jwt() ->> 'email') are unchanged.

create or replace function public.is_event_owner(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e where e.id = p_event_id and e.owner_id = auth.uid()
  );
$$;

create or replace function public.is_event_participant_email(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_participants ep
    where ep.event_id = p_event_id
      and ep.email is not null
      and lower(ep.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.is_own_participant(p_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_participants ep
    where ep.id = p_participant_id
      and ep.email is not null
      and lower(ep.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.is_item_owner(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.receipt_items ri
    join public.events e on e.id = ri.event_id
    where ri.id = p_item_id and e.owner_id = auth.uid()
  );
$$;

create or replace function public.shares_event_as_owner(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    join public.event_participants ep on ep.event_id = e.id
    where e.owner_id = p_owner_id
      and ep.email is not null
      and lower(ep.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_event_owner(uuid) to authenticated;
grant execute on function public.is_event_participant_email(uuid) to authenticated;
grant execute on function public.is_own_participant(uuid) to authenticated;
grant execute on function public.is_item_owner(uuid) to authenticated;
grant execute on function public.shares_event_as_owner(uuid) to authenticated;

-- --- events ------------------------------------------------------------
drop policy if exists "events_select_participant" on public.events;
create policy "events_select_participant" on public.events
  for select using (is_event_participant_email(events.id));

-- --- event_participants -------------------------------------------------
drop policy if exists "participants_all_owner" on public.event_participants;
create policy "participants_all_owner" on public.event_participants
  for all using (is_event_owner(event_participants.event_id))
  with check (is_event_owner(event_participants.event_id));

-- --- receipt_items --------------------------------------------------------
drop policy if exists "items_all_owner" on public.receipt_items;
create policy "items_all_owner" on public.receipt_items
  for all using (is_event_owner(receipt_items.event_id))
  with check (is_event_owner(receipt_items.event_id));

drop policy if exists "items_select_participant" on public.receipt_items;
create policy "items_select_participant" on public.receipt_items
  for select using (is_event_participant_email(receipt_items.event_id));

-- --- item_consumption -----------------------------------------------------
drop policy if exists "consumption_all_owner" on public.item_consumption;
create policy "consumption_all_owner" on public.item_consumption
  for all using (is_item_owner(item_consumption.item_id))
  with check (is_item_owner(item_consumption.item_id));

drop policy if exists "consumption_self_select" on public.item_consumption;
create policy "consumption_self_select" on public.item_consumption
  for select using (is_own_participant(item_consumption.participant_id));

drop policy if exists "consumption_self_upsert" on public.item_consumption;
create policy "consumption_self_upsert" on public.item_consumption
  for insert with check (is_own_participant(item_consumption.participant_id));

drop policy if exists "consumption_self_update" on public.item_consumption;
create policy "consumption_self_update" on public.item_consumption
  for update using (is_own_participant(item_consumption.participant_id));

-- --- profiles ---------------------------------------------------------
drop policy if exists "profiles_select_as_event_owner_for_participant" on public.profiles;
create policy "profiles_select_as_event_owner_for_participant" on public.profiles
  for select using (shares_event_as_owner(profiles.id));
