import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuantityPicker } from '@/components/quantity-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { formatMoney } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import type { ReceiptItem } from '@/types/database';

export default function ConsumptionScreen() {
  const { id, participant: participantParam } = useLocalSearchParams<{ id: string; participant?: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [currency, setCurrency] = useState('CLP');
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [isSelf, setIsSelf] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [{ data: event }, { data: itemRows }, { data: eventParticipants }] = await Promise.all([
      supabase.from('events').select('currency, owner_id').eq('id', id).single(),
      supabase.from('receipt_items').select('*').eq('event_id', id).order('position'),
      // RLS scopes this to "my own row" for a non-owner; the owner gets
      // every participant, which is what lets her open anyone's consumption.
      supabase.from('event_participants').select('id, name, is_owner, email').eq('event_id', id),
    ]);
    if (event) setCurrency(event.currency);
    setItems((itemRows as ReceiptItem[]) ?? []);

    const isOwner = event?.owner_id === session.user.id;
    const myEmail = session.user.email?.toLowerCase();
    const rows = eventParticipants ?? [];

    // If a specific participant was requested (the owner opening someone
    // else's consumption from the event screen), use that; RLS already
    // guarantees a non-owner can only ever see their own row here, so this
    // can't be used to peek at anyone else's.
    const target = participantParam
      ? rows.find((p) => p.id === participantParam)
      : rows.find((p) => (isOwner && p.is_owner) || (myEmail && p.email?.toLowerCase() === myEmail));

    setParticipantId(target?.id ?? null);
    setParticipantName(target?.name ?? null);
    setIsSelf(!!target && ((isOwner && target.is_owner) || (myEmail && target.email?.toLowerCase() === myEmail)));

    if (target?.id) {
      const { data: consumption } = await supabase
        .from('item_consumption')
        .select('item_id, quantity')
        .eq('participant_id', target.id);
      const map: Record<string, string> = {};
      for (const row of consumption ?? []) {
        map[row.item_id] = String(row.quantity);
      }
      setQuantities(map);
    }
  }, [id, session, participantParam]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const commit = async (itemId: string, value: number) => {
    if (!participantId) return;
    await supabase.from('item_consumption').upsert(
      { item_id: itemId, participant_id: participantId, quantity: value, updated_at: new Date().toISOString() },
      { onConflict: 'item_id,participant_id' }
    );
  };

  const setQuantity = (itemId: string, text: string) => {
    setQuantities((prev) => ({ ...prev, [itemId]: text }));
  };

  const finish = async () => {
    if (participantId) {
      setFinishing(true);
      await supabase.from('event_participants').update({ consumption_completed: true }).eq('id', participantId);
      setFinishing(false);
    }
    router.back();
  };

  const total = items.reduce((sum, item) => {
    const qty = Number(quantities[item.id] ?? 0) || 0;
    return sum + qty * item.unit_price;
  }, 0);

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Stack.Screen options={{ title: isSelf ? 'Mi consumo' : `Consumo de ${participantName ?? ''}` }} />
      <ThemedView style={styles.container}>
        <ThemedText type="muted">
          {isSelf
            ? 'Marca cuánto consumiste de cada producto (0, 0.5, 1, 1.5…), igual que en la planilla.'
            : `Marca cuánto consumió ${participantName} de cada producto (0, 0.5, 1, 1.5…).`}
        </ThemedText>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: Spacing.sm, paddingVertical: Spacing.sm }}
          renderItem={({ item }) => (
            <Card style={{ gap: Spacing.sm }}>
              <ThemedView style={styles.itemHeader}>
                <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>
                  {item.name}
                </ThemedText>
                <ThemedText type="caption">{formatMoney(item.unit_price, currency)} c/u</ThemedText>
              </ThemedView>
              <QuantityPicker
                value={quantities[item.id] ?? '0'}
                onChange={(t) => setQuantity(item.id, t)}
                onCommit={(v) => commit(item.id, v)}
              />
            </Card>
          )}
        />

        <Card style={styles.totalCard}>
          <ThemedText type="defaultSemiBold">{isSelf ? 'Tu subtotal' : `Subtotal de ${participantName}`}</ThemedText>
          <ThemedText type="subtitle">{formatMoney(total, currency)}</ThemedText>
        </Card>

        <Button label="Listo" onPress={finish} loading={finishing} />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
