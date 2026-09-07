import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Switch } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';

export type NewParticipant = {
  name: string;
  email: string | null;
  contactId: string | null;
};

type AddParticipantModalProps = {
  visible: boolean;
  onClose: () => void;
  ownerId: string;
  onAdd: (participant: NewParticipant) => void;
};

/** Bottom-sheet popup to add someone who isn't a saved contact yet — from the
 * "new event" screen or from an event's participant list. Name is required,
 * email is optional (mirrors the nullable `email` column on both `contacts`
 * and `event_participants`), and saving to contacts is opt-in. */
export function AddParticipantModal({ visible, onClose, ownerId, onAdd }: AddParticipantModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saveToContacts, setSaveToContacts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');

  const reset = () => {
    setName('');
    setEmail('');
    setSaveToContacts(true);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const add = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);

    let contactId: string | null = null;
    if (saveToContacts) {
      const { data, error: contactError } = await supabase
        .from('contacts')
        .insert({ owner_id: ownerId, name: trimmedName, email: trimmedEmail || null })
        .select('id')
        .single();
      if (contactError) {
        setSaving(false);
        Alert.alert('Error', 'No se pudo guardar el contacto.');
        return;
      }
      contactId = data.id;
    }

    setSaving(false);
    onAdd({ name: trimmedName, email: trimmedEmail || null, contactId });
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <ThemedView style={[styles.sheet, { backgroundColor: card, borderColor: border }]}>
        <ThemedView style={styles.sheetHeader}>
          <ThemedText type="subtitle">Nuevo participante</ThemedText>
          <Pressable onPress={close} hitSlop={8}>
            <IconSymbol name="xmark" size={22} color={tint} />
          </Pressable>
        </ThemedView>

        <ThemedView style={{ gap: Spacing.sm }}>
          <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: María Ignacia" />
          <TextField
            label="Correo (opcional)"
            value={email}
            onChangeText={setEmail}
            placeholder="Ej: maria.ignacia@gmail.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <ThemedView style={styles.switchRow}>
            <ThemedText>Guardar en contactos</ThemedText>
            <Switch value={saveToContacts} onValueChange={setSaveToContacts} />
          </ThemedView>
          {error ? <ThemedText style={{ color: danger }}>{error}</ThemedText> : null}
        </ThemedView>

        <Button label="Agregar" onPress={add} loading={saving} />
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
});
