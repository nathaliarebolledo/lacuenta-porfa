import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ImageViewerModal } from '@/components/image-viewer-modal';
import { PayInfoModal } from '@/components/pay-info-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatBankInfoText } from '@/lib/bank-info';
import { formatMoney } from '@/lib/currency';
import { loadEventDetail, type EventDetail } from '@/lib/event-detail-api';
import { supabase } from '@/lib/supabase';
import type { PaymentStatus } from '@/types/database';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showPayInfo, setShowPayInfo] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');

  const load = useCallback(async () => {
    if (!id) return;
    const data = await loadEventDetail(id);
    setDetail(data);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  if (loading || !detail) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const { event, participants, items, totals, ownerBank } = detail;
  const isOwner = session?.user.id === event.owner_id;
  const myEmail = session?.user.email?.toLowerCase();
  const myParticipant = participants.find(
    (p) => (isOwner && p.is_owner) || (myEmail && p.email?.toLowerCase() === myEmail)
  );

  // The fixed total of the boleta itself — what it actually cost, regardless
  // of how much of it people have gotten around to marking as "mine" so far.
  // (totals.grandSubtotal instead sums *assigned* consumption, which is
  // naturally less than this until everyone finishes marking their share.)
  const receiptSubtotal = items.reduce((sum, item) => sum + (item.original_price ?? item.unit_price), 0);
  const receiptWithTip = receiptSubtotal * (1 + event.tip_percent / 100);

  // "Cobrado" counts the owner's own share too — she already "paid" it by
  // fronting the whole bill, so it's money that's settled either way — plus
  // whatever other participants have paid her back. "Por cobrar" is simply
  // the rest of the fixed receipt total, so the two always add up exactly.
  const ownerParticipant = participants.find((p) => p.is_owner);
  const ownerOwnTotal = ownerParticipant ? totals.perParticipant[ownerParticipant.id]?.withTip ?? 0 : 0;
  const collectedTotal =
    ownerOwnTotal +
    participants
      .filter((p) => !p.is_owner && p.payment_status === 'paid')
      .reduce((sum, p) => sum + (totals.perParticipant[p.id]?.withTip ?? 0), 0);
  const pendingTotal = Math.max(0, receiptWithTip - collectedTotal);

  const setPaymentStatus = async (participantId: string, status: PaymentStatus) => {
    setUpdatingPayment(true);
    const { error } = await supabase
      .from('event_participants')
      .update({ payment_status: status })
      .eq('id', participantId);
    setUpdatingPayment(false);
    if (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado de pago.');
      return;
    }
    load();
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      try {
        const { data: files } = await supabase.storage.from('receipts').list(`${event.owner_id}/${event.id}`);
        if (files?.length) {
          await supabase.storage
            .from('receipts')
            .remove(files.map((f) => `${event.owner_id}/${event.id}/${f.name}`));
        }
      } catch {
        // best-effort cleanup — a failure here shouldn't block deleting the event itself
      }

      // .select() so we can tell a real 0-row delete (RLS silently matched
      // nothing) apart from a genuine success — a plain delete() would look
      // identical (no error) in both cases.
      const { data, error } = await supabase.from('events').delete().eq('id', event.id).select('id');
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      if (!data?.length) {
        Alert.alert('Error', 'No se pudo eliminar el evento (no tienes permiso o ya fue eliminado).');
        return;
      }
      router.replace('/');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar el evento.');
    } finally {
      setDeleting(false);
    }
  };

  const deleteEvent = () => {
    const message = `¿Eliminar "${event.name}"? Se borra para todas las personas y no se puede deshacer.`;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) {
        performDelete();
      }
      return;
    }

    Alert.alert('Eliminar evento', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: performDelete },
    ]);
  };

  const copyBankInfo = async () => {
    if (!detail?.ownerBank) return;
    await Clipboard.setStringAsync(formatBankInfoText(detail.ownerBank));
    Alert.alert('Copiado', 'Los datos bancarios se copiaron al portapapeles.');
  };

  const pickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0] || !session) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const path = `${session.user.id}/${event.id}/receipt.${ext}`;

      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, blob, {
        upsert: true,
        contentType: asset.mimeType ?? 'image/jpeg',
      });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('receipts').getPublicUrl(path);
      await supabase
        .from('events')
        .update({ receipt_photo_url: `${publicUrl.publicUrl}?t=${Date.now()}` })
        .eq('id', event.id);
      // Jump straight into the AI review flow — reading the receipt
      // automatically is the whole point; loading products by hand is only
      // the fallback if that fails (or she wants to add more later).
      router.push(`/event/${event.id}/scan`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo subir la foto.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView>
          <ThemedText type="title">{event.name}</ThemedText>
          <ThemedText type="muted">{new Date(event.event_date).toLocaleDateString('es-CL')}</ThemedText>
        </ThemedView>

        {event.receipt_photo_url ? (
          <Pressable onPress={() => setShowReceipt(true)} style={styles.receiptWrapper}>
            <Image source={{ uri: event.receipt_photo_url }} style={styles.receipt} />
            {isOwner ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  pickReceipt();
                }}
                style={[styles.changePhotoButton, { backgroundColor: tint }]}
                hitSlop={8}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <IconSymbol name="camera.fill" size={16} color="#fff" />
                )}
              </Pressable>
            ) : null}
          </Pressable>
        ) : isOwner ? (
          <Pressable onPress={pickReceipt}>
            <ThemedView style={[styles.receiptPlaceholder, { borderColor: border }]}>
              {uploading ? (
                <ActivityIndicator />
              ) : (
                <>
                  <IconSymbol name="camera.fill" size={28} color={tint} />
                  <ThemedText type="muted">Subir foto de la boleta</ThemedText>
                </>
              )}
            </ThemedView>
          </Pressable>
        ) : null}

        {isOwner && event.receipt_photo_url ? (
          <Button
            label="Leer boleta con IA"
            variant="secondary"
            onPress={() => router.push(`/event/${event.id}/scan`)}
          />
        ) : null}

        {isOwner ? (
          <ThemedView style={styles.actionsRow}>
            <ActionButton icon="doc.text.fill" label="Productos" onPress={() => router.push(`/event/${event.id}/items`)} />
            <ActionButton
              icon="checkmark.circle.fill"
              label="Mi consumo"
              onPress={() => router.push(`/event/${event.id}/consumption?participant=${myParticipant?.id}`)}
            />
            <ActionButton icon="square.and.arrow.up" label="Compartir" onPress={() => router.push(`/event/${event.id}/share`)} />
          </ThemedView>
        ) : null}

        {!isOwner && myParticipant ? (
          <Button
            label="Marcar mi consumo"
            onPress={() => router.push(`/event/${event.id}/consumption?participant=${myParticipant.id}`)}
          />
        ) : null}

        <Card>
          <ThemedText type="defaultSemiBold">Total del evento</ThemedText>
          <ThemedView style={styles.totalsRow}>
            <ThemedText type="muted">Subtotal</ThemedText>
            <ThemedText>{formatMoney(receiptSubtotal, event.currency)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.totalsRow}>
            <ThemedText type="muted">Con propina ({event.tip_percent}%)</ThemedText>
            <ThemedText type="defaultSemiBold">{formatMoney(receiptWithTip, event.currency)}</ThemedText>
          </ThemedView>

          {isOwner ? (
            <>
              <ThemedView style={styles.divider} />
              <ThemedView style={styles.totalsRow}>
                <ThemedText style={{ color: successColor }}>Cobrado</ThemedText>
                <ThemedText style={{ color: successColor, fontWeight: '700' }}>
                  {formatMoney(collectedTotal, event.currency)}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.totalsRow}>
                <ThemedText style={{ color: dangerColor }}>Por cobrar</ThemedText>
                <ThemedText style={{ color: dangerColor, fontWeight: '700' }}>
                  {formatMoney(pendingTotal, event.currency)}
                </ThemedText>
              </ThemedView>
            </>
          ) : null}
        </Card>

        <ThemedText type="defaultSemiBold" style={{ marginTop: Spacing.sm }}>
          {isOwner ? 'Participantes' : 'Tu total'}
        </ThemedText>

        {(isOwner ? participants : myParticipant ? [myParticipant] : []).map((p) => {
          const total = totals.perParticipant[p.id] ?? { subtotal: 0, withTip: 0 };
          const isMe = myParticipant?.id === p.id;
          const canToggle = (isOwner && !p.is_owner) || (!isOwner && isMe);
          // The owner can open — and edit — anyone's consumption, not just
          // her own; a non-owner can only open her own.
          const canOpenConsumption = isOwner || isMe;
          return (
            <Pressable
              key={p.id}
              disabled={!canOpenConsumption}
              onPress={
                canOpenConsumption
                  ? () => router.push(`/event/${event.id}/consumption?participant=${p.id}`)
                  : undefined
              }>
              <Card style={styles.participantCard}>
                <Avatar name={p.name} size={40} />
                <ThemedView style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <ThemedText type="defaultSemiBold">
                    {p.name} {p.is_owner ? '(dueña)' : ''}
                  </ThemedText>
                  <ThemedText type="caption">{formatMoney(total.subtotal, event.currency)} + propina</ThemedText>
                  <ThemedText type="subtitle">{formatMoney(total.withTip, event.currency)}</ThemedText>
                </ThemedView>

                {p.is_owner
                  ? null
                  : canToggle
                    ? (
                        <Pressable
                          disabled={updatingPayment}
                          onPress={() => setPaymentStatus(p.id, p.payment_status === 'paid' ? 'pending' : 'paid')}>
                          <Badge
                            label={p.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}
                            tone={p.payment_status === 'paid' ? 'success' : 'danger'}
                          />
                        </Pressable>
                      )
                    : (
                        <Badge
                          label={p.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}
                          tone={p.payment_status === 'paid' ? 'success' : 'danger'}
                        />
                      )}
              </Card>
            </Pressable>
          );
        })}

        {!isOwner && myParticipant ? <Button label="Pagar" onPress={() => setShowPayInfo(true)} /> : null}

        {isOwner ? (
          <ThemedView style={{ marginTop: Spacing.md }}>
            <Button label="Eliminar evento" variant="danger" onPress={deleteEvent} loading={deleting} />
          </ThemedView>
        ) : null}
      </ScrollView>

      <ImageViewerModal
        visible={showReceipt}
        uri={event.receipt_photo_url}
        onClose={() => setShowReceipt(false)}
      />

      {!isOwner && myParticipant ? (
        <PayInfoModal
          visible={showPayInfo}
          onClose={() => setShowPayInfo(false)}
          ownerBank={ownerBank}
          paymentStatus={myParticipant.payment_status}
          updating={updatingPayment}
          onCopy={copyBankInfo}
          onTogglePaid={() =>
            setPaymentStatus(myParticipant.id, myParticipant.payment_status === 'paid' ? 'pending' : 'paid')
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

function ActionButton({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  return (
    <Pressable onPress={onPress} style={[styles.actionButton, { backgroundColor: card }]}>
      <ThemedView style={[styles.actionIcon, { backgroundColor: tint + '1f' }]}>
        <IconSymbol name={icon} size={20} color={tint} />
      </ThemedView>
      <ThemedText type="caption" style={{ fontWeight: '600' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  receiptWrapper: {
    position: 'relative',
  },
  receipt: {
    width: '100%',
    height: 180,
    borderRadius: Radius.lg,
  },
  changePhotoButton: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    ...CardShadow,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128,128,128,0.3)',
    marginVertical: 2,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
