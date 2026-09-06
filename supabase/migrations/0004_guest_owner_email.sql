-- Adds the owner's email to the guest-link payload, so the "Pagar" popup can
-- show it alongside the RUT/bank details (matching what a logged-in
-- participant already sees via profiles_select_as_event_owner_for_participant).
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
      'email', v_owner.email,
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
