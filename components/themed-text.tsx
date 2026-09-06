import { StyleSheet, Text, type TextProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'subtitle' | 'defaultSemiBold' | 'link' | 'muted' | 'caption';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const textColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const color = type === 'muted' || type === 'caption' ? mutedColor : textColor;

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'caption' ? styles.caption : undefined,
        type === 'link' ? [styles.link, { color: tint }] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 22,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  link: {
    lineHeight: 22,
    fontSize: 16,
    fontWeight: '700',
  },
});
