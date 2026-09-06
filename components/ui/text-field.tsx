import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const background = useThemeColor({}, 'background');
  const danger = useThemeColor({}, 'danger');

  return (
    <View style={styles.wrap}>
      {label ? <ThemedText style={styles.label}>{label}</ThemedText> : null}
      <TextInput
        placeholderTextColor={muted}
        style={[
          styles.input,
          {
            color: text,
            backgroundColor: background,
            borderColor: error ? danger : 'transparent',
            borderWidth: error ? 1.5 : 0,
          },
          style,
        ]}
        {...rest}
      />
      {error ? <ThemedText style={{ color: danger, fontSize: 13 }}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 16,
  },
});
