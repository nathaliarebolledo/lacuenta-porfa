import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Switch } from 'react-native';
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
import { supabase } from '@/lib/supabase';
import { splitUnitPrice } from '@/lib/totals';

type DraftItem = {
  name: string;
  price: string; // total price as read from the receipt
  divided: boolean;
  splitCount: string; // only meaningful when divided is true
};

export default function ScanReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const danger = useThemeColor({}, 'danger');

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('receipt_photo_url, currency')
        .eq('id', id)
        .single();
      if (eventError || !event?.receipt_photo_url) {
        throw new Error('Este evento todavía no tiene una foto de boleta.');
      }

      const { data, error: fnError } = await supabase.functions.invoke('parse-receipt', {
        body: { imageUrl: event.receipt_photo_url },
      });

      if (fnError) throw fnError;
      if (!data?.items?.length) throw new Error('No se detectaron productos en la foto.');

      setItems(
        data.items.map((i: { name: string; price: number }) => ({
          name: i.name,
          price: String(Math.round(i.price)),
          divided: false,
          splitCount: '2',
        }))
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo leer la boleta. Puedes cargar los productos manualmente.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      scan();
    }, [scan])
  );

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const confirm = async () => {
    const valid = items.filter((it) => it.name.trim() && Number(it.price) > 0);
    if (!valid.length) {
      Alert.alert('Nada que guardar', 'Revisa que al menos un producto tenga nombre y precio.');
      return;
    }
    setSaving(true);

    const { count } = await supabase
      .from('receipt_items')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id);
    const startPosition = count ?? 0;

    const rows = valid.map((it, index) => {
      const totalPrice = Number(it.price);
      const splitCount = it.divided ? Math.max(2, Number(it.splitCount) || 2) : null;
      return {
        event_id: id,
        name: it.name.trim(),
        unit_price: splitCount ? splitUnitPrice(totalPrice, splitCount) : totalPrice,
        original_price: splitCount ? totalPrice : null,
        split_count: splitCount,
        source: 'ocr' as const,
        position: startPosition + index,
      };
    });

    const { error: insertError } = await supabase.from('receipt_items').insert(rows);
    setSaving(false);
    if (insertError) {
      Alert.alert('Error', insertError.message);
      return;
    }
    router.replace(`/event/${id}/items`);
  };

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm }}>
        <ActivityIndicator size="large" />
        <ThemedText type="muted">Leyendo la boleta con IA…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ThemedView style={styles.container}>
        {error ? (
          <ThemedView style={{ gap: Spacing.sm }}>
            <ThemedText style={{ color: danger }}>{error}</ThemedText>
            <Button label="Reintentar" variant="secondary" onPress={scan} />
            <Button label="Cargar manualmente" variant="ghost" onPress={() => router.replace(`/event/${id}/items`)} />
          </ThemedView>
        ) : (
          <>
            <ThemedText type="muted">
              Revisa y corrige lo que la IA detectó antes de guardar — nada se guarda hasta que
              confirmes. Si un producto se compartió, actívalo y di entre cuántas personas.
            </ThemedText>

            <FlatList
              data={items}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ gap: Spacing.sm, paddingVertical: Spacing.sm }}
              renderItem={({ item, index }) => {
                const totalPrice = Number(item.price) || 0;
                const splitCount = Math.max(2, Number(item.splitCount) || 2);
                const unitPrice = item.divided ? splitUnitPrice(totalPrice, splitCount) : totalPrice;

                return (
                  <Card style={{ gap: Spacing.sm }}>
                    <ThemedView style={styles.row}>
                      <ThemedView style={{ flex: 1 }}>
                        <TextField
                          value={item.name}
                          onChangeText={(t) => updateItem(index, { name: t })}
                          placeholder="Producto"
                        />
                      </ThemedView>
                      <Pressable onPress={() => removeItem(index)} hitSlop={8}>
                        <IconSymbol name="trash.fill" size={20} color={danger} />
                      </Pressable>
                    </ThemedView>

                    <ThemedView style={styles.row}>
                      <ThemedView style={{ flex: 1 }}>
                        <TextField
                          label={item.divided ? 'Precio total' : 'Precio'}
                          value={item.price}
                          onChangeText={(t) => updateItem(index, { price: t.replace(/[^0-9]/g, '') })}
                          keyboardType="numeric"
                          placeholder="Precio"
                        />
                      </ThemedView>
                      {item.divided ? (
                        <ThemedView style={{ width: 90 }}>
                          <TextField
                            label="Entre"
                            value={item.splitCount}
                            onChangeText={(t) => updateItem(index, { splitCount: t.replace(/[^0-9]/g, '') })}
                            keyboardType="number-pad"
                            placeholder="2"
                          />
                        </ThemedView>
                      ) : null}
                    </ThemedView>

                    <ThemedView style={[styles.row, { justifyContent: 'space-between' }]}>
                      <ThemedView style={[styles.row, { gap: Spacing.xs }]}>
                        <Switch
                          value={item.divided}
                          onValueChange={(v) => updateItem(index, { divided: v })}
                        />
                        <ThemedText type="caption">Se dividió entre varias personas</ThemedText>
                      </ThemedView>
                      {item.divided ? (
                        <ThemedText type="caption">{formatMoney(unitPrice)} c/u</ThemedText>
                      ) : null}
                    </ThemedView>
                  </Card>
                );
              }}
            />

            <Button label={`Guardar ${items.length} producto(s)`} onPress={confirm} loading={saving} />
          </>
        )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
