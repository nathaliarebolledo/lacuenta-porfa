import { Pressable, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

const QUICK_VALUES = [0, 0.5, 1, 1.5, 2];

type QuantityPickerProps = {
  value: string;
  onChange: (text: string) => void;
  onCommit: (value: number) => void;
};

/**
 * The chip row for common quantities (0, 0.5, 1…) plus a clearly separate
 * "otra cantidad" box — pulled out of a single squeezed row (where the free
 * text input was easy to miss) into its own labeled line.
 */
export function QuantityPicker({ value, onChange, onCommit }: QuantityPickerProps) {
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const isQuickValue = QUICK_VALUES.includes(Number(value));

  return (
    <ThemedView style={{ gap: Spacing.xs }}>
      <ThemedView style={styles.chipRow}>
        {QUICK_VALUES.map((v) => {
          const active = Number(value) === v;
          return (
            <Pressable
              key={v}
              onPress={() => {
                onChange(String(v));
                onCommit(v);
              }}
              style={[
                styles.chip,
                { borderColor: active ? tint : border, backgroundColor: active ? tint : card },
              ]}>
              <ThemedText style={{ color: active ? '#fff' : undefined, fontWeight: '700' }}>{v}</ThemedText>
            </Pressable>
          );
        })}
      </ThemedView>

      <ThemedView style={styles.customRow}>
        <ThemedText type="caption">Otra cantidad:</ThemedText>
        <TextInput
          value={isQuickValue ? '' : value}
          onChangeText={onChange}
          onEndEditing={() => onCommit(Number(value) || 0)}
          keyboardType="numeric"
          placeholder="ej: 3"
          style={[styles.customInput, { borderColor: border, backgroundColor: card }]}
        />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  chip: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    fontSize: 16,
  },
});
