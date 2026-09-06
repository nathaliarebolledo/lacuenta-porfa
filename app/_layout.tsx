import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { ActivityIndicator, StyleSheet } from 'react-native';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <ThemedView style={styles.splash}>
        <ActivityIndicator size="large" />
        <ThemedText type="muted" style={{ marginTop: 12 }}>
          Cargando La cuenta, porfa…
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="event/new" options={{ headerShown: true, title: 'Nuevo evento', presentation: 'modal' }} />
        <Stack.Screen name="event/[id]/index" options={{ headerShown: true, title: 'Evento' }} />
        <Stack.Screen name="event/[id]/items" options={{ headerShown: true, title: 'Productos' }} />
        <Stack.Screen name="event/[id]/scan" options={{ headerShown: true, title: 'Leer boleta con IA' }} />
        <Stack.Screen name="event/[id]/consumption" options={{ headerShown: true, title: 'Mi consumo' }} />
        <Stack.Screen name="event/[id]/share" options={{ headerShown: true, title: 'Compartir link', presentation: 'modal' }} />
      </Stack.Protected>

      {/* Public: reachable with or without a session, no guard. */}
      <Stack.Screen name="guest/[token]" options={{ headerShown: true, title: 'La cuenta, porfa' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={DefaultTheme}>
        <RootNavigator />
        <StatusBar style="dark" />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
