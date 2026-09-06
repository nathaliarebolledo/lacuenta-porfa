import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Platform, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { getWebBaseUrl } from '@/lib/web-url';

export default function ShareEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [link, setLink] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    supabase
      .from('events')
      .select('name, guest_token')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setEventName(data.name);
        setLink(`${getWebBaseUrl()}/guest/${data.guest_token}`);
      });
  }, [id]);

  const copy = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    if (Platform.OS === 'web') {
      Alert.alert('Copiado', 'El link se copió al portapapeles.');
    }
  };

  const share = async () => {
    if (!link) return;
    const message = `Hola! Te comparto la cuenta de "${eventName}" para que marques tu consumo: ${link}`;
    if (Platform.OS === 'web' && (navigator as any).share) {
      await (navigator as any).share({ title: 'La cuenta, porfa', text: message, url: link });
    } else {
      await Share.share({ message });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ThemedView style={styles.container}>
        <ThemedText type="defaultSemiBold">Link de invitado</ThemedText>
        <ThemedText type="caption">
          Cualquiera con este link puede abrirlo, elegir su nombre entre los participantes y marcar
          su consumo, sin necesidad de crear cuenta.
        </ThemedText>

        <Card>
          <ThemedText selectable>{link ?? 'Generando…'}</ThemedText>
        </Card>

        <ThemedView style={{ gap: Spacing.sm }}>
          <Button label="Compartir link" onPress={share} disabled={!link} />
          <Button label="Copiar link" variant="secondary" onPress={copy} disabled={!link} />
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
});
