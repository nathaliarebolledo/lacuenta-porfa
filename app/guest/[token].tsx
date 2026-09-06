import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ImageViewerModal } from '@/components/image-viewer-modal';
import { PayInfoModal } from '@/components/pay-info-modal';
import { QuantityPicker } from '@/components/quantity-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatBankInfoText, type BankInfo } from '@/lib/bank-info';
import { formatMoney } from '@/lib/currency';
import { supabase } from '@/lib/supabase';

type GuestEvent = {
  event: {
    id: string;
    name: string;
    event_date: string;
    tip_percent: number;
    currency: string;
    receipt_photo_url: string | null;
  };
  owner_bank: BankInfo;
  participants: { id: string; name: string; payment_status: 'pending' | 'paid' }[];
  items: { id: string; name: string; unit_price: number; position: number }[];
};

export default function GuestEventScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<GuestEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [showPayInfo, setShowPayInfo] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const border = useThemeColor({}, 'border');

  const storageKey = `lacuenta-porfa:guest:${token}`;

  const selectParticipant = async (id: string) => {
    setParticipantId(id);
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, id);
    } catch {}
    const { data: consumption } = await supabase.rpc('rpc_guest_my_consumption', {
      p_token: token,
      p_participant_id: id,
    });
    const map: Record<string, string> = {};
    for (const row of (consumption as { item_id: string; quantity: number }[]) ?? []) {
      map[row.item_id] = String(row.quantity);
    }
    setQuantities(map);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: result, error: rpcError } = await supabase.rpc('rpc_guest_event', { p_token: token });
    if (rpcError || !result) {
      setError('Este link ya no es válido.');
      setLoading(false);
      return;
    }
    setData(result as GuestEvent);

    let savedId: string | null = null;
    try {
      savedId = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
    } catch {}
    if (savedId && (result as GuestEvent).participants.some((p) => p.id === savedId)) {
      await selectParticipant(savedId);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const setQuantity = (itemId: string, text: string) => {
    setQuantities((prev) => ({ ...prev, [itemId]: text }));
  };

  const commit = async (itemId: string, value: number) => {
    if (!participantId) return;
    await supabase.rpc('rpc_guest_set_consumption', {
      p_token: token,
      p_participant_id: participantId,
      p_item_id: itemId,
      p_quantity: value,
    });
  };

  const setPaymentStatus = async (status: 'pending' | 'paid') => {
    if (!participantId) return;
    setUpdatingPayment(true);
    const { error: rpcError } = await supabase.rpc('rpc_guest_set_payment_status', {
      p_token: token,
      p_participant_id: participantId,
      p_status: status,
    });
    setUpdatingPayment(false);
    if (rpcError) {
      Alert.alert('Error', 'No se pudo actualizar el estado de pago.');
      return;
    }
    setData((prev) =>
      prev
        ? {
            ...prev,
            participants: prev.participants.map((p) =>
              p.id === participantId ? { ...p, payment_status: status } : p
            ),
          }
        : prev
    );
  };

  const copyBankInfo = async (bank: BankInfo) => {
    await Clipboard.setStringAsync(formatBankInfoText(bank));
    Alert.alert('Copiado', 'Los datos bancarios se copiaron al portapapeles.');
  };

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (error || !data) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }}>
        <ThemedText type="subtitle">{error ?? 'Link inválido'}</ThemedText>
      </ThemedView>
    );
  }

  const { event, items, participants, owner_bank } = data;
  const myParticipant = participants.find((p) => p.id === participantId);

  const subtotal = items.reduce((sum, item) => sum + (Number(quantities[item.id] ?? 0) || 0) * item.unit_price, 0);
  const withTip = subtotal * (1 + event.tip_percent / 100);

  if (!participantId) {
    return (
      <>
        <SafeAreaView style={{ flex: 1 }}>
          <ThemedView style={styles.container}>
            <ThemedText type="title">{event.name}</ThemedText>
            <ThemedText type="muted">{new Date(event.event_date).toLocaleDateString('es-CL')}</ThemedText>

            {event.receipt_photo_url ? (
              <Pressable onPress={() => setShowReceipt(true)}>
                <Image source={{ uri: event.receipt_photo_url }} style={styles.receipt} />
              </Pressable>
            ) : null}

            <ThemedText type="muted" style={{ marginTop: Spacing.sm, marginBottom: Spacing.md }}>
              ¿Quién eres tú en este evento?
            </ThemedText>
            <FlatList
              data={participants}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ gap: Spacing.sm }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => selectParticipant(item.id)}
                  style={[styles.pickRow, { borderColor: border }]}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                </Pressable>
              )}
            />
          </ThemedView>
        </SafeAreaView>

        <ImageViewerModal
          visible={showReceipt}
          uri={event.receipt_photo_url}
          onClose={() => setShowReceipt(false)}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView>
          <ThemedText type="title">{event.name}</ThemedText>
          <ThemedText type="muted">{new Date(event.event_date).toLocaleDateString('es-CL')}</ThemedText>
          <ThemedText type="muted">Hola, {myParticipant?.name}. Marca cuánto consumiste:</ThemedText>
        </ThemedView>

        {event.receipt_photo_url ? (
          <Pressable onPress={() => setShowReceipt(true)}>
            <Image source={{ uri: event.receipt_photo_url }} style={styles.receipt} />
          </Pressable>
        ) : null}

        {items.map((item) => (
          <Card key={item.id} style={{ gap: Spacing.sm }}>
            <ThemedView style={styles.itemHeader}>
              <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>
                {item.name}
              </ThemedText>
              <ThemedText type="caption">{formatMoney(item.unit_price, event.currency)} c/u</ThemedText>
            </ThemedView>
            <QuantityPicker
              value={quantities[item.id] ?? '0'}
              onChange={(t) => setQuantity(item.id, t)}
              onCommit={(v) => commit(item.id, v)}
            />
          </Card>
        ))}

        <Card>
          <ThemedView style={styles.totalsRow}>
            <ThemedText type="muted">Subtotal</ThemedText>
            <ThemedText>{formatMoney(subtotal, event.currency)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.totalsRow}>
            <ThemedText type="defaultSemiBold">Total con propina ({event.tip_percent}%)</ThemedText>
            <ThemedText type="subtitle">{formatMoney(withTip, event.currency)}</ThemedText>
          </ThemedView>
          {myParticipant ? (
            <Badge
              label={myParticipant.payment_status === 'paid' ? 'Ya pagado' : 'Pendiente de pago'}
              tone={myParticipant.payment_status === 'paid' ? 'success' : 'warning'}
            />
          ) : null}
        </Card>

        <Button label="Pagar" onPress={() => setShowPayInfo(true)} />

        <Pressable onPress={() => setParticipantId(null)}>
          <ThemedText type="link" style={{ textAlign: 'center' }}>
            No soy {myParticipant?.name}, cambiar
          </ThemedText>
        </Pressable>
      </ScrollView>

      <PayInfoModal
        visible={showPayInfo}
        onClose={() => setShowPayInfo(false)}
        ownerBank={owner_bank}
        paymentStatus={myParticipant?.payment_status ?? 'pending'}
        updating={updatingPayment}
        onCopy={() => copyBankInfo(owner_bank)}
        onTogglePaid={() => setPaymentStatus(myParticipant?.payment_status === 'paid' ? 'pending' : 'paid')}
      />

      <ImageViewerModal
        visible={showReceipt}
        uri={event.receipt_photo_url}
        onClose={() => setShowReceipt(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  pickRow: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  receipt: {
    width: '100%',
    height: 180,
    borderRadius: Radius.lg,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
