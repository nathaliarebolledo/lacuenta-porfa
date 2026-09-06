import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const successBg = useThemeColor({}, 'successBg');
  const success = useThemeColor({}, 'success');
  const warningBg = useThemeColor({}, 'warningBg');
  const warning = useThemeColor({}, 'warning');
  const dangerBg = useThemeColor({}, 'dangerBg');
  const danger = useThemeColor({}, 'danger');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'textMuted');

  const map = {
    success: { bg: successBg, fg: success },
    warning: { bg: warningBg, fg: warning },
    danger: { bg: dangerBg, fg: danger },
    neutral: { bg: border, fg: text },
  } as const;

  const { bg, fg } = map[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText style={{ color: fg, fontSize: 13, fontWeight: '700' }}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
});
