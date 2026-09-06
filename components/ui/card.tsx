import { StyleSheet, View, type ViewProps } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export function Card({ style, ...rest }: ViewProps) {
  const backgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  return <View style={[styles.card, { backgroundColor, borderColor }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...CardShadow,
  },
});
