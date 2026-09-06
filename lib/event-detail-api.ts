import type { BankInfo } from '@/lib/bank-info';
import { supabase } from '@/lib/supabase';
import { computeEventTotals } from '@/lib/totals';
import type { Event, EventParticipant, EventTotals, ItemConsumption, ReceiptItem } from '@/types/database';

export type EventDetail = {
  event: Event;
  participants: EventParticipant[];
  items: ReceiptItem[];
  consumption: ItemConsumption[];
  totals: EventTotals;
  ownerBank: BankInfo | null;
};

export async function loadEventDetail(eventId: string): Promise<EventDetail> {
  const [{ data: event, error: eventError }, { data: participants }, { data: items }] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('event_participants').select('*').eq('event_id', eventId).order('created_at'),
    supabase.from('receipt_items').select('*').eq('event_id', eventId).order('position'),
  ]);

  if (eventError || !event) throw eventError ?? new Error('Evento no encontrado');

  const itemIds = (items ?? []).map((i) => i.id);
  const [{ data: consumption }, { data: ownerBank }] = await Promise.all([
    itemIds.length
      ? supabase.from('item_consumption').select('*').in('item_id', itemIds)
      : Promise.resolve({ data: [] as ItemConsumption[] }),
    supabase
      .from('profiles')
      .select('full_name, email, bank_name, account_type, account_number, account_holder, rut_or_reference')
      .eq('id', (event as Event).owner_id)
      .maybeSingle(),
  ]);

  const totals = computeEventTotals(
    (items as ReceiptItem[]) ?? [],
    (consumption as ItemConsumption[]) ?? [],
    (event as Event).tip_percent
  );

  return {
    event: event as Event,
    participants: (participants as EventParticipant[]) ?? [],
    items: (items as ReceiptItem[]) ?? [],
    consumption: (consumption as ItemConsumption[]) ?? [],
    totals,
    ownerBank: (ownerBank as BankInfo) ?? null,
  };
}
