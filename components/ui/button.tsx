import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, RaisedShadow, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type ButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ComponentProps<typeof View>['children'];
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  icon,
  disabled,
  ...rest
}: ButtonProps) {
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');
  const dangerBg = useThemeColor({}, 'dangerBg');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');

  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? tint
      : variant === 'danger'
        ? dangerBg
        : variant === 'secondary'
          ? border
          : 'transparent';

  const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? danger : variant === 'secondary' ? text : tint;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'primary' && RaisedShadow,
        {
          backgroundColor,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: pressed && !isDisabled ? [{ scale: 0.98 }] : undefined,
        },
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <ThemedText style={{ color: textColor, fontWeight: '700', fontSize: 16 }}>{label}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
