import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatMoney } from '@/lib/currency';
import { splitUnitPrice } from '@/lib/totals';
import { supabase } from '@/lib/supabase';
import type { ReceiptItem } from '@/types/database';
import { showAlert } from '@/lib/alert';

export default function ItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [currency, setCurrency] = useState('CLP');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');

  const load = useCallback(async () => {
    const [{ data: event }, { data: rows }] = await Promise.all([
      supabase.from('events').select('currency').eq('id', id).single(),
      supabase.from('receipt_items').select('*').eq('event_id', id).order('position'),
    ]);
    if (event) setCurrency(event.currency);
    setItems((rows as ReceiptItem[]) ?? []);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const remove = (item: ReceiptItem) => {
    showAlert('Eliminar producto', `¿Eliminar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('receipt_items').delete().eq('id', item.id);
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ThemedView style={styles.container}>
        {showForm ? (
          <ItemForm
            eventId={id}
            nextPosition={items.length}
            onDone={() => {
              setShowForm(false);
              load();
            }}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <>
            <Button label="Leer boleta con IA" variant="secondary" onPress={() => router.push(`/event/${id}/scan`)} />

            <Pressable onPress={() => setShowForm(true)} style={[styles.addRow, { borderColor: tint }]}>
              <IconSymbol name="plus" size={18} color={tint} />
              <ThemedText style={{ color: tint, fontWeight: '600' }}>Agregar producto</ThemedText>
            </Pressable>

            {loading ? (
              <ActivityIndicator style={{ marginTop: Spacing.xl }} />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: Spacing.sm, paddingVertical: Spacing.sm }}
                ListEmptyComponent={
                  <ThemedText type="muted" style={{ marginTop: Spacing.lg }}>
                    Aún no hay productos cargados desde la boleta.
                  </ThemedText>
                }
                renderItem={({ item }) => (
                  <Card style={styles.itemRow}>
                    <ThemedView style={{ flex: 1 }}>
                      <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                      {item.split_count && item.split_count > 1 ? (
                        <ThemedText type="caption">
                          {formatMoney(item.original_price ?? 0, currency)} ÷ {item.split_count}
                        </ThemedText>
                      ) : null}
                    </ThemedView>
                    <ThemedText type="defaultSemiBold">{formatMoney(item.unit_price, currency)}</ThemedText>
                    <Pressable onPress={() => remove(item)} hitSlop={8} style={{ marginLeft: Spacing.sm }}>
                      <IconSymbol name="trash.fill" size={18} color={danger} />
                    </Pressable>
                  </Card>
                )}
              />
            )}
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

function ItemForm({
  eventId,
  nextPosition,
  onDone,
  onCancel,
}: {
  eventId: string;
  nextPosition: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [divided, setDivided] = useState(false);
  const [splitCount, setSplitCount] = useState('2');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const danger = useThemeColor({}, 'danger');

  const save = async () => {
    const priceNumber = Number(price.replace(/[^0-9.]/g, ''));
    if (!name.trim() || !priceNumber) {
      setError('Ingresa nombre y precio.');
      return;
    }
    const count = divided ? Math.max(2, Number(splitCount) || 2) : null;
    const unitPrice = count ? splitUnitPrice(priceNumber, count) : priceNumber;

    setSaving(true);
    const { error: err } = await supabase.from('receipt_items').insert({
      event_id: eventId,
      name: name.trim(),
      unit_price: unitPrice,
      original_price: count ? priceNumber : null,
      split_count: count,
      position: nextPosition,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onDone();
  };

  return (
    <ThemedView style={{ gap: Spacing.sm }}>
      <TextField label="Producto" value={name} onChangeText={setName} placeholder="Schop Heineken" />
      <TextField
        label={divided ? 'Precio total del producto' : 'Precio'}
        value={price}
        onChangeText={setPrice}
        placeholder="4900"
        keyboardType="numeric"
      />
      <ThemedView style={styles.switchRow}>
        <ThemedText>Se dividió entre varias personas</ThemedText>
        <Switch value={divided} onValueChange={setDivided} />
      </ThemedView>
      {divided ? (
        <TextField
          label="¿Entre cuántas partes?"
          value={splitCount}
          onChangeText={setSplitCount}
          keyboardType="number-pad"
        />
      ) : null}
      {error ? <ThemedText style={{ color: danger }}>{error}</ThemedText> : null}
      <ThemedView style={{ gap: Spacing.sm }}>
        <Button label="Guardar producto" onPress={save} loading={saving} />
        <Button label="Cancelar" variant="secondary" onPress={onCancel} />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
