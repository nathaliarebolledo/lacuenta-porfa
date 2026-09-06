import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';
import type { AccountType } from '@/types/database';

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Cuenta corriente' },
  { value: 'vista', label: 'Cuenta vista' },
  { value: 'savings', label: 'Cuenta de ahorro' },
  { value: 'other', label: 'Otra' },
];

export default function ProfileScreen() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [bankName, setBankName] = useState(profile?.bank_name ?? '');
  const [accountType, setAccountType] = useState<AccountType>(profile?.account_type ?? 'checking');
  const [accountNumber, setAccountNumber] = useState(profile?.account_number ?? '');
  const [accountHolder, setAccountHolder] = useState(profile?.account_holder ?? profile?.full_name ?? '');
  const [rut, setRut] = useState(profile?.rut_or_reference ?? '');
  const [saving, setSaving] = useState(false);

  // The profile can arrive from context *after* this screen has already
  // mounted (it's fetched async right after login), and can also change
  // underneath this screen (e.g. right after save()'s refreshProfile()) —
  // re-sync the form whenever it changes/whenever this tab regains focus,
  // instead of only reading it once as initial state.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      setBankName(profile.bank_name ?? '');
      setAccountType(profile.account_type ?? 'checking');
      setAccountNumber(profile.account_number ?? '');
      setAccountHolder(profile.account_holder ?? profile.full_name ?? '');
      setRut(profile.rut_or_reference ?? '');
    }, [profile])
  );

  const save = async () => {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        bank_name: bankName.trim() || null,
        account_type: accountType,
        account_number: accountNumber.trim() || null,
        account_holder: accountHolder.trim() || null,
        rut_or_reference: rut.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    await refreshProfile();
    Alert.alert('Listo', 'Tus datos bancarios se guardaron.');
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.hero}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : null}
          <ThemedText type="title">{profile?.full_name ?? 'Mi perfil'}</ThemedText>
          <ThemedText type="muted">{profile?.email}</ThemedText>
        </ThemedView>

        <ThemedView style={{ gap: 2, marginTop: Spacing.sm }}>
          <ThemedText type="subtitle">Datos bancarios</ThemedText>
          <ThemedText type="caption">Para recibir transferencias.</ThemedText>
        </ThemedView>

        <Card style={{ gap: Spacing.md }}>
          <ThemedView style={{ gap: Spacing.sm }}>
            <ThemedText type="defaultSemiBold">Titular de la cuenta</ThemedText>
            <TextField label="Nombre completo" value={accountHolder} onChangeText={setAccountHolder} placeholder="Ej: María Pérez" />
            <TextField label="RUT" value={rut} onChangeText={setRut} placeholder="Ej: 12.345.678-9" autoCapitalize="none" />
          </ThemedView>

          <ThemedView style={styles.divider} />

          <ThemedView style={{ gap: Spacing.sm }}>
            <ThemedText type="defaultSemiBold">Cuenta bancaria</ThemedText>
            <TextField label="Banco" value={bankName} onChangeText={setBankName} placeholder="Ej: Banco de Chile" />

            <ThemedView style={{ gap: Spacing.xs }}>
              <ThemedText style={styles.fieldLabel}>Tipo de cuenta</ThemedText>
              <AccountTypeSelector value={accountType} onChange={setAccountType} />
            </ThemedView>

            <TextField
              label="Número de cuenta"
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="Ej: 00123456789"
              keyboardType="number-pad"
            />
          </ThemedView>

          <Button label="Guardar datos bancarios" onPress={save} loading={saving} />
        </Card>

        <Button label="Cerrar sesión" variant="ghost" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

function AccountTypeSelector({
  value,
  onChange,
}: {
  value: AccountType;
  onChange: (v: AccountType) => void;
}) {
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');

  return (
    <ThemedView style={styles.typeGrid}>
      {ACCOUNT_TYPES.map((t) => {
        const active = value === t.value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            style={[
              styles.typeOption,
              { borderColor: active ? tint : border, backgroundColor: active ? tint : background },
            ]}>
            <ThemedText style={{ color: active ? '#fff' : undefined, fontWeight: '600', fontSize: 14 }}>
              {t.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: Spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  typeOption: {
    flexBasis: '48%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
});
