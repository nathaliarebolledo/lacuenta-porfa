-- Split Bill: initial schema, Row Level Security policies and guest-link RPCs.
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles ("users" in the spec) — one row per authenticated user, mirrors
-- auth.users. Holds the bank details needed to receive transfers.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  bank_name text,
  account_type text check (account_type in ('checking', 'savings', 'vista', 'other')),
  account_number text,
  account_holder text,
  rut_or_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- A logged-in participant also needs to read the event owner's bank details,
-- to know where to transfer their share (mirrors what the guest-link RPC
-- exposes to unauthenticated participants). That policy references
-- event_participants and events, so it is declared near the bottom of this
-- file, once both tables exist.

-- Auto-create a profile row whenever a new auth user signs up (Google OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- contacts — saved by each user, reusable across events.
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "contacts_all_own" on public.contacts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- events — one outing / tab.
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  event_date date not null default current_date,
  receipt_photo_url text,
  status text not null default 'open' check (status in ('open', 'closed')),
  tip_percent numeric(5, 2) not null default 10,
  currency text not null default 'CLP',
  guest_token uuid not null default gen_random_uuid() unique,
  -- reserved for Phase 2 (raw AI vision response, kept nullable so no future migration is needed)
  receipt_ocr_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "events_all_owner" on public.events
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Note: the "participant can also SELECT the event" policy is created further
-- down, once public.event_participants exists (Postgres validates the table
-- reference when the policy is created).

-- ---------------------------------------------------------------------------
-- event_participants — who is in the event, and their payment status.
-- The `email` column freezes the address as typed when added: it is the key
-- used later to decide which events a Google-authenticated user can see.
-- ---------------------------------------------------------------------------
create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  name text not null,
  email text,
  phone text,
  is_owner boolean not null default false,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  consumption_completed boolean not null default false,
  -- reserved for Phase 2 (payment reminders)
  reminder_last_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.event_participants enable row level security;

create policy "participants_all_owner" on public.event_participants
  for all using (
    exists (select 1 from public.events e where e.id = event_participants.event_id and e.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.events e where e.id = event_participants.event_id and e.owner_id = auth.uid())
  );

create policy "participants_select_self" on public.event_participants
  for select using (
    email is not null and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Now that event_participants exists, allow a participant to also SELECT the
-- parent event itself (needed to show it in "Mis eventos").
create policy "events_select_participant" on public.events
  for select using (
    exists (
      select 1 from public.event_participants ep
      where ep.event_id = events.id
        and ep.email is not null
        and lower(ep.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ---------------------------------------------------------------------------
-- receipt_items — products on the bill.
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  unit_price numeric(12, 2) not null default 0,
  source text not null default 'manual' check (source in ('manual', 'ocr')),
  split_count integer check (split_count is null or split_count > 0),
  original_price numeric(12, 2),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.receipt_items enable row level security;

create policy "items_all_owner" on public.receipt_items
  for all using (
    exists (select 1 from public.events e where e.id = receipt_items.event_id and e.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.events e where e.id = receipt_items.event_id and e.owner_id = auth.uid())
  );

create policy "items_select_participant" on public.receipt_items
  for select using (
    exists (
      select 1 from public.event_participants ep
      where ep.event_id = receipt_items.event_id
        and ep.email is not null
        and lower(ep.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ---------------------------------------------------------------------------
-- item_consumption — how much of each item each participant had.
-- ---------------------------------------------------------------------------
create table if not exists public.item_consumption (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.receipt_items (id) on delete cascade,
  participant_id uuid not null references public.event_participants (id) on delete cascade,
  quantity numeric(6, 2) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (item_id, participant_id)
);

alter table public.item_consumption enable row level security;

create policy "consumption_all_owner" on public.item_consumption
  for all using (
    exists (
      select 1 from public.receipt_items ri
      join public.events e on e.id = ri.event_id
      where ri.id = item_consumption.item_id and e.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.receipt_items ri
      join public.events e on e.id = ri.event_id
      where ri.id = item_consumption.item_id and e.owner_id = auth.uid()
    )
  );

create policy "consumption_self_select" on public.item_consumption
  for select using (
    exists (
      select 1 from public.event_participants ep
      where ep.id = item_consumption.participant_id
        and ep.email is not null
        and lower(ep.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "consumption_self_upsert" on public.item_consumption
  for insert with check (
    exists (
      select 1 from public.event_participants ep
      where ep.id = item_consumption.participant_id
        and ep.email is not null
        and lower(ep.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

create policy "consumption_self_update" on public.item_consumption
  for update using (
    exists (
      select 1 from public.event_participants ep
      where ep.id = item_consumption.participant_id
        and ep.email is not null
        and lower(ep.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ---------------------------------------------------------------------------
-- Guest-link access (no login): SECURITY DEFINER RPCs gated by guest_token.
-- The token is a capability secret — anyone holding the link can read the
-- event and self-identify as one of the existing participants, matching the
-- "share a link, no account needed" flow from the spec. Payment status can
-- NEVER be changed through these RPCs — only the authenticated owner can do
-- that via the `event_participants` owner policy above.
-- ---------------------------------------------------------------------------
create or replace function public.rpc_guest_event(p_token uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_owner public.profiles%rowtype;
  result jsonb;
begin
  select * into v_event from public.events where guest_token = p_token;
  if not found then
    raise exception 'invite_not_found';
  end if;

  select * into v_owner from public.profiles where id = v_event.owner_id;

  select jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_event.id,
      'name', v_event.name,
      'event_date', v_event.event_date,
      'status', v_event.status,
      'tip_percent', v_event.tip_percent,
      'currency', v_event.currency,
      'receipt_photo_url', v_event.receipt_photo_url
    ),
    'owner_bank', jsonb_build_object(
      'full_name', v_owner.full_name,
      'bank_name', v_owner.bank_name,
      'account_type', v_owner.account_type,
      'account_number', v_owner.account_number,
      'account_holder', v_owner.account_holder,
      'rut_or_reference', v_owner.rut_or_reference
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object('id', ep.id, 'name', ep.name, 'payment_status', ep.payment_status) order by ep.created_at)
      from public.event_participants ep where ep.event_id = v_event.id
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', ri.id, 'name', ri.name, 'unit_price', ri.unit_price, 'position', ri.position) order by ri.position)
      from public.receipt_items ri where ri.event_id = v_event.id
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.rpc_guest_event(uuid) to anon, authenticated;

create or replace function public.rpc_guest_my_consumption(p_token uuid, p_participant_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_ok boolean;
  result jsonb;
begin
  select exists (
    select 1 from public.event_participants ep
    join public.events e on e.id = ep.event_id
    where ep.id = p_participant_id and e.guest_token = p_token
  ) into v_ok;

  if not v_ok then
    raise exception 'participant_not_in_event';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('item_id', ic.item_id, 'quantity', ic.quantity)), '[]'::jsonb)
  into result
  from public.item_consumption ic
  where ic.participant_id = p_participant_id;

  return result;
end;
$$;

grant execute on function public.rpc_guest_my_consumption(uuid, uuid) to anon, authenticated;

create or replace function public.rpc_guest_set_consumption(
  p_token uuid,
  p_participant_id uuid,
  p_item_id uuid,
  p_quantity numeric
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_ok boolean;
begin
  if p_quantity < 0 then
    raise exception 'invalid_quantity';
  end if;

  select exists (
    select 1
    from public.event_participants ep
    join public.events e on e.id = ep.event_id
    join public.receipt_items ri on ri.event_id = e.id
    where ep.id = p_participant_id
      and ri.id = p_item_id
      and e.guest_token = p_token
  ) into v_ok;

  if not v_ok then
    raise exception 'participant_or_item_not_in_event';
  end if;

  insert into public.item_consumption (item_id, participant_id, quantity, updated_at)
  values (p_item_id, p_participant_id, p_quantity, now())
  on conflict (item_id, participant_id)
  do update set quantity = excluded.quantity, updated_at = now();
end;
$$;

grant execute on function public.rpc_guest_set_consumption(uuid, uuid, uuid, numeric) to anon, authenticated;

-- Deferred from the profiles section above: lets a logged-in participant read
-- the event owner's bank details for events they belong to.
create policy "profiles_select_as_event_owner_for_participant" on public.profiles
  for select using (
    exists (
      select 1 from public.events e
      join public.event_participants ep on ep.event_id = e.id
      where e.owner_id = profiles.id
        and ep.email is not null
        and lower(ep.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for receipt photos.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Receipts are stored under `<owner_uid>/<event_id>/<filename>`, so ownership
-- is checked from the path itself rather than relying on storage-internal
-- owner columns (whose type has changed across Supabase storage versions).
create policy "receipts_owner_write" on storage.objects
  for all using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts_public_read" on storage.objects
  for select using (bucket_id = 'receipts');
