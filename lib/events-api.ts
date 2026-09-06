import { supabase } from '@/lib/supabase';
import { computeEventTotals } from '@/lib/totals';
import type { Event, EventParticipant, ItemConsumption, ReceiptItem } from '@/types/database';

export type EventSummary = {
  event: Event;
  isOwner: boolean;
  myParticipant: EventParticipant | null;
  myTotal: { subtotal: number; withTip: number } | null;
  participantCount: number;
  pendingCount: number;
};

export async function listMyEvents(userId: string, myEmail: string | null): Promise<EventSummary[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select('*, event_participants(*)')
    .order('event_date', { ascending: false });

  if (error) throw error;

  const summaries = await Promise.all(
    (events ?? []).map(async (row: any) => {
      const event = row as Event;
      const participants = (row.event_participants ?? []) as EventParticipant[];
      const isOwner = event.owner_id === userId;
      const myParticipant =
        participants.find((p) => (isOwner && p.is_owner) || (myEmail && p.email?.toLowerCase() === myEmail.toLowerCase())) ??
        null;

      let myTotal: EventSummary['myTotal'] = null;

      if (myParticipant) {
        const { data: items } = await supabase
          .from('receipt_items')
          .select('id, unit_price')
          .eq('event_id', event.id);

        const { data: consumption } = await supabase
          .from('item_consumption')
          .select('item_id, participant_id, quantity')
          .eq('participant_id', myParticipant.id);

        const totals = computeEventTotals(
          (items as ReceiptItem[]) ?? [],
          (consumption as ItemConsumption[]) ?? [],
          event.tip_percent
        );
        myTotal = totals.perParticipant[myParticipant.id] ?? { subtotal: 0, withTip: 0 };
      }

      return {
        event,
        isOwner,
        myParticipant,
        myTotal,
        participantCount: participants.length,
        pendingCount: participants.filter((p) => p.payment_status === 'pending' && !p.is_owner).length,
      } satisfies EventSummary;
    })
  );

  return summaries;
}
