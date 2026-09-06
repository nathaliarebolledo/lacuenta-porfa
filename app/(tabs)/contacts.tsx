import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TextField } from '@/components/ui/text-field';
import { Radius, RaisedShadow, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';
import type { Contact } from '@/types/database';

export default function ContactsScreen() {
  const { session } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');

  const load = useCallback(async () => {
    const { data } = await supabase.from('contacts').select('*').order('name');
    setContacts((data as Contact[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const remove = (contact: Contact) => {
    Alert.alert('Eliminar contacto', `¿Eliminar a ${contact.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('contacts').delete().eq('id', contact.id);
          load();
        },
      },
    ]);
  };

  if (editing) {
    return (
      <ContactForm
        ownerId={session!.user.id}
        initial={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Contactos</ThemedText>
          <Pressable
            onPress={() => setEditing('new')}
            style={[styles.newButton, { backgroundColor: tint }, RaisedShadow]}>
            <IconSymbol name="plus" size={20} color="#fff" />
          </Pressable>
        </ThemedView>

        {loading ? (
          <ActivityIndicator style={{ marginTop: Spacing.xl }} />
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
            ListEmptyComponent={
              <ThemedView style={styles.empty}>
                <IconSymbol name="person.2.fill" size={36} color={tint} />
                <ThemedText type="defaultSemiBold" style={{ marginTop: Spacing.sm }}>
                  Sin contactos todavía
                </ThemedText>
                <ThemedText type="muted" style={{ textAlign: 'center' }}>
                  Agrega a tus amigos para invitarlos a tus eventos.
                </ThemedText>
              </ThemedView>
            }
            renderItem={({ item }) => (
              <Card style={styles.row}>
                <Avatar name={item.name} />
                <ThemedView style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                  {item.email ? <ThemedText type="caption">{item.email}</ThemedText> : null}
                </ThemedView>
                <Pressable onPress={() => setEditing(item)} hitSlop={8} style={{ marginRight: Spacing.md }}>
                  <IconSymbol name="pencil" size={20} color={tint} />
                </Pressable>
                <Pressable onPress={() => remove(item)} hitSlop={8}>
                  <IconSymbol name="trash.fill" size={20} color={danger} />
                </Pressable>
              </Card>
            )}
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

function ContactForm({
  ownerId,
  initial,
  onDone,
  onCancel,
}: {
  ownerId: string;
  initial: Contact | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const danger = useThemeColor({}, 'danger');

  const save = async () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!email.trim()) {
      setError('El correo es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      owner_id: ownerId,
      name: name.trim(),
      email: email.trim(),
    };
    const { error: err } = initial
      ? await supabase.from('contacts').update(payload).eq('id', initial.id)
      : await supabase.from('contacts').insert(payload);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onDone();
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">{initial ? 'Editar contacto' : 'Nuevo contacto'}</ThemedText>
        <ThemedView style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
          <TextField label="Nombre" value={name} onChangeText={setName} placeholder="Ej: María Ignacia" />
          <TextField
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="Ej: maria.ignacia@gmail.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {error ? <ThemedText style={{ color: danger }}>{error}</ThemedText> : null}
        </ThemedView>
        <ThemedView style={{ gap: Spacing.sm, marginTop: Spacing.lg }}>
          <Button label="Guardar" onPress={save} loading={saving} />
          <Button label="Cancelar" variant="secondary" onPress={onCancel} />
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  empty: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
});
