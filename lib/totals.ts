import type { EventTotals } from '@/types/database';

type ItemLike = { id: string; unit_price: number };
type ConsumptionLike = { item_id: string; participant_id: string; quantity: number };

/**
 * Mirrors the spreadsheet formulas exactly:
 *   Total por persona = sum(precio del producto * consumo de esa persona)
 *   Total con propina  = Total por persona * (1 + tip%/100)
 */
export function computeEventTotals(
  items: ItemLike[],
  consumption: ConsumptionLike[],
  tipPercent: number
): EventTotals {
  const priceByItem = new Map(items.map((i) => [i.id, i.unit_price]));
  const perParticipant: EventTotals['perParticipant'] = {};

  for (const row of consumption) {
    const price = priceByItem.get(row.item_id) ?? 0;
    const amount = price * row.quantity;
    if (!perParticipant[row.participant_id]) {
      perParticipant[row.participant_id] = { subtotal: 0, withTip: 0 };
    }
    perParticipant[row.participant_id].subtotal += amount;
  }

  const tipMultiplier = 1 + tipPercent / 100;
  let grandSubtotal = 0;
  for (const key of Object.keys(perParticipant)) {
    perParticipant[key].withTip = perParticipant[key].subtotal * tipMultiplier;
    grandSubtotal += perParticipant[key].subtotal;
  }

  return {
    perParticipant,
    grandSubtotal,
    grandWithTip: grandSubtotal * tipMultiplier,
  };
}

export function splitUnitPrice(totalPrice: number, splitCount: number) {
  if (splitCount <= 0) return totalPrice;
  return Math.round((totalPrice / splitCount) * 100) / 100;
}
