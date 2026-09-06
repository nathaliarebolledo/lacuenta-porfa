-- Lets a participant (logged in with a matching email, or via the guest
-- link) mark their OWN row as paid/pending, in addition to the event owner.
-- A participant can never touch anything else about their row (name, email,
-- is_owner, etc.) — enforced by a trigger, not just by what the app's UI
-- sends, so it holds even against a direct API call.

create or replace function public.enforce_participant_self_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_owner_acting boolean;
begin
  select exists (
    select 1 from public.events e where e.id = new.event_id and e.owner_id = auth.uid()
  ) into v_is_owner_acting;

  if v_is_owner_acting then
    return new;
  end if;

  -- Not the owner: this update can only be the participant marking their own
  -- payment status. Every other column must stay exactly as it was.
  if new.event_id is distinct from old.event_id
    or new.contact_id is distinct from old.contact_id
    or new.name is distinct from old.name
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.is_owner is distinct from old.is_owner
    or new.consumption_completed is distinct from old.consumption_completed
  then
    raise exception 'participants_self_update_payment_status_only';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_participant_self_update on public.event_participants;
create trigger trg_enforce_participant_self_update
  before update on public.event_participants
  for each row execute function public.enforce_participant_self_update();

-- Logged-in participant, own row, own payment status.
drop policy if exists "participants_self_update_payment" on public.event_participants;
create policy "participants_self_update_payment" on public.event_participants
  for update using (is_own_participant(event_participants.id))
  with check (is_own_participant(event_participants.id));

-- Guest-link participant (no login): same capability via a token-gated RPC.
create or replace function public.rpc_guest_set_payment_status(
  p_token uuid,
  p_participant_id uuid,
  p_status text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_ok boolean;
begin
  if p_status not in ('pending', 'paid') then
    raise exception 'invalid_status';
  end if;

  select exists (
    select 1 from public.event_participants ep
    join public.events e on e.id = ep.event_id
    where ep.id = p_participant_id and e.guest_token = p_token
  ) into v_ok;

  if not v_ok then
    raise exception 'participant_not_in_event';
  end if;

  update public.event_participants
  set payment_status = p_status
  where id = p_participant_id;
end;
$$;

grant execute on function public.rpc_guest_set_payment_status(uuid, uuid, text) to anon, authenticated;
