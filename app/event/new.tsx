import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddParticipantModal, type NewParticipant } from '@/components/add-participant-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';
import type { Contact } from '@/types/database';
import { showAlert } from '@/lib/alert';

export default function NewEventScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extraParticipants, setExtraParticipants] = useState<NewParticipant[]>([]);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [saving, setSaving] = useState(false);
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');

  useEffect(() => {
    supabase
      .from('contacts')
      .select('*')
      .order('name')
      .then(({ data }) => setContacts((data as Contact[]) ?? []));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const create = async () => {
    if (!session) return;
    if (!name.trim()) {
      showAlert('Falta el nombre', 'Ponle un nombre al evento, ej. "Cuenta Bar La Virgen".');
      return;
    }
    setSaving(true);
    const { data: event, error } = await supabase
      .from('events')
      .insert({ owner_id: session.user.id, name: name.trim(), event_date: new Date().toISOString().slice(0, 10) })
      .select()
      .single();

    if (error || !event) {
      setSaving(false);
      showAlert('Error', error?.message ?? 'No se pudo crear el evento.');
      return;
    }

    const chosenContacts = contacts.filter((c) => selected.has(c.id));
    const participantRows = [
      {
        event_id: event.id,
        name: profile?.full_name ?? 'Yo',
        email: profile?.email ?? session.user.email ?? null,
        is_owner: true,
      },
      ...chosenContacts.map((c) => ({
        event_id: event.id,
        contact_id: c.id,
        name: c.name,
        email: c.email,
        is_owner: false,
      })),
      ...extraParticipants.map((p) => ({
        event_id: event.id,
        contact_id: p.contactId,
        name: p.name,
        email: p.email,
        is_owner: false,
      })),
    ];

    const { error: participantsError } = await supabase.from('event_participants').insert(participantRows);
    setSaving(false);

    if (participantsError) {
      showAlert('Error', participantsError.message);
      return;
    }

    router.replace(`/event/${event.id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ThemedView style={styles.container}>
        <TextField label="Nombre del evento" value={name} onChangeText={setName} placeholder="Cuenta Bar La Virgen" />

        <ThemedText type="defaultSemiBold" style={{ marginTop: Spacing.md }}>
          ¿Quiénes participaron?
        </ThemedText>
        <ThemedText type="caption">Tú quedas incluida automáticamente como dueña del evento.</ThemedText>

        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          style={{ marginTop: Spacing.sm }}
          contentContainerStyle={{ gap: Spacing.xs }}
          ListEmptyComponent={
            <ThemedText type="muted" style={{ marginTop: Spacing.md }}>
              No tienes contactos aún. Puedes crear el evento igual y agregarlos después.
            </ThemedText>
          }
          renderItem={({ item }) => {
            const active = selected.has(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                style={[
                  styles.contactRow,
                  { borderColor: active ? tint : border, backgroundColor: active ? tint + '15' : 'transparent' },
                ]}>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                {active ? <IconSymbol name="checkmark.circle.fill" size={20} color={tint} /> : null}
              </Pressable>
            );
          }}
        />

        {extraParticipants.length ? (
          <ThemedView style={{ gap: Spacing.xs, marginTop: Spacing.sm }}>
            {extraParticipants.map((p, index) => (
              <ThemedView key={`${p.name}-${index}`} style={[styles.contactRow, { borderColor: border }]}>
                <ThemedText type="defaultSemiBold">{p.name}</ThemedText>
                <Pressable
                  onPress={() => setExtraParticipants((prev) => prev.filter((_, i) => i !== index))}
                  hitSlop={8}>
                  <IconSymbol name="xmark" size={18} color={tint} />
                </Pressable>
              </ThemedView>
            ))}
          </ThemedView>
        ) : null}

        <Pressable onPress={() => setShowAddParticipant(true)} style={styles.addParticipantRow}>
          <IconSymbol name="plus.circle.fill" size={20} color={tint} />
          <ThemedText style={{ color: tint, fontWeight: '600' }}>Agregar participante nuevo</ThemedText>
        </Pressable>

        <ThemedView style={{ marginTop: Spacing.md }}>
          <Button label="Crear evento" onPress={create} loading={saving} />
        </ThemedView>
      </ThemedView>

      {session ? (
        <AddParticipantModal
          visible={showAddParticipant}
          onClose={() => setShowAddParticipant(false)}
          ownerId={session.user.id}
          onAdd={(participant) => {
            setExtraParticipants((prev) => [...prev, participant]);
            setShowAddParticipant(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addParticipantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
