import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AvatarPalette } from '@/constants/theme';

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AvatarPalette[Math.abs(hash) % AvatarPalette.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const backgroundColor = colorForName(name || '?');
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}>
      <ThemedText style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>
        {initialsFor(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
