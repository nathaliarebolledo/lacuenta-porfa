import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InstallBanner } from '@/components/install-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radius, RaisedShadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { formatMoney } from '@/lib/currency';
import { listMyEvents, type EventSummary } from '@/lib/events-api';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function MyEventsScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const [summaries, setSummaries] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tint = useThemeColor({}, 'tint');

  const load = useCallback(async () => {
    if (!session) return;
    const data = await listMyEvents(session.user.id, profile?.email ?? session.user.email ?? null);
    setSummaries(data);
  }, [session, profile]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Mis eventos</ThemedText>
          <Pressable
            onPress={() => router.push('/event/new')}
            style={[styles.newButton, { backgroundColor: tint }, RaisedShadow]}>
            <IconSymbol name="plus" size={20} color="#fff" />
          </Pressable>
        </ThemedView>

        <InstallBanner />

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} />
        ) : (
          <FlatList
            data={summaries}
            keyExtractor={(item) => item.event.id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <ThemedView style={styles.empty}>
                <IconSymbol name="doc.text.fill" size={36} color={tint} />
                <ThemedText type="defaultSemiBold" style={{ marginTop: Spacing.sm }}>
                  Sin eventos todavía
                </ThemedText>
                <ThemedText type="muted" style={{ textAlign: 'center' }}>
                  Toca “+” para crear tu primera cuenta compartida.
                </ThemedText>
              </ThemedView>
            }
            renderItem={({ item }) => <EventCard summary={item} />}
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

function EventCard({ summary }: { summary: EventSummary }) {
  const router = useRouter();
  const { event, isOwner, myTotal, myParticipant, pendingCount } = summary;
  const tint = useThemeColor({}, 'tint');

  return (
    <Pressable onPress={() => router.push(`/event/${event.id}`)}>
      <Card>
        <ThemedView style={styles.cardHeader}>
          <ThemedView style={[styles.eventIcon, { backgroundColor: tint + '1f' }]}>
            <IconSymbol name="doc.text.fill" size={20} color={tint} />
          </ThemedView>
          <ThemedView style={{ flex: 1 }}>
            <ThemedText type="defaultSemiBold" numberOfLines={1}>
              {event.name}
            </ThemedText>
            <ThemedText type="caption">{new Date(event.event_date).toLocaleDateString('es-CL')}</ThemedText>
          </ThemedView>
          {isOwner ? <Badge label="Dueña" tone="neutral" /> : null}
        </ThemedView>

        <ThemedView style={styles.cardFooter}>
          <ThemedView>
            <ThemedText type="caption">Tu total</ThemedText>
            <ThemedText type="subtitle">
              {formatMoney(myTotal?.withTip ?? 0, event.currency)}
            </ThemedText>
          </ThemedView>

          {isOwner ? (
            <Badge
              label={pendingCount === 0 ? 'Pagado' : `${pendingCount} pendiente(s)`}
              tone={pendingCount === 0 ? 'success' : 'warning'}
            />
          ) : myParticipant ? (
            <Badge
              label={myParticipant.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}
              tone={myParticipant.payment_status === 'paid' ? 'success' : 'danger'}
            />
          ) : null}
        </ThemedView>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  empty: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
});
