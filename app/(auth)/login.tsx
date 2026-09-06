import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const danger = useThemeColor({}, 'danger');

  const onPress = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.hero}>
          <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
          <ThemedText type="title">Split Bill</ThemedText>
          <ThemedText type="muted" style={styles.subtitle}>
            Divide la cuenta del restobar con tus amigos. Sube la boleta, cada quien marca lo suyo,
            y listo.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.actions}>
          <Button
            label="Continuar con Google"
            onPress={onPress}
            loading={loading}
            icon={<Ionicons name="logo-google" size={18} color="#fff" />}
          />
          {error ? (
            <ThemedText style={{ color: danger, textAlign: 'center', marginTop: Spacing.sm }}>{error}</ThemedText>
          ) : null}
          <ThemedText type="caption" style={styles.legal}>
            ¿Tienes un link de invitado? Ábrelo directamente desde el mensaje que te compartieron:
            no necesitas iniciar sesión para marcar tu consumo.
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    marginBottom: Spacing.md,
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 320,
  },
  actions: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  legal: {
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
