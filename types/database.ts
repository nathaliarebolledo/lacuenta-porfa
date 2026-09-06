export type PaymentStatus = 'pending' | 'paid';
export type EventStatus = 'open' | 'closed';
export type ItemSource = 'manual' | 'ocr';
export type AccountType = 'checking' | 'savings' | 'vista' | 'other';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bank_name: string | null;
  account_type: AccountType | null;
  account_number: string | null;
  account_holder: string | null;
  rut_or_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  owner_id: string;
  name: string;
  event_date: string;
  receipt_photo_url: string | null;
  status: EventStatus;
  tip_percent: number;
  currency: string;
  guest_token: string;
  created_at: string;
  updated_at: string;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  contact_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  is_owner: boolean;
  payment_status: PaymentStatus;
  consumption_completed: boolean;
  created_at: string;
}

export interface ReceiptItem {
  id: string;
  event_id: string;
  name: string;
  unit_price: number;
  source: ItemSource;
  split_count: number | null;
  original_price: number | null;
  position: number;
  created_at: string;
}

export interface ItemConsumption {
  id: string;
  item_id: string;
  participant_id: string;
  quantity: number;
  updated_at: string;
}

export interface EventTotals {
  perParticipant: Record<string, { subtotal: number; withTip: number }>;
  grandSubtotal: number;
  grandWithTip: number;
}
