import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ACCOUNT_TYPE_LABELS, hasBankInfo, type BankInfo } from '@/lib/bank-info';

type PayInfoModalProps = {
  visible: boolean;
  onClose: () => void;
  ownerBank: BankInfo | null;
  paymentStatus: 'pending' | 'paid';
  updating: boolean;
  onCopy: () => void;
  onTogglePaid: () => void;
};

/** Bottom-sheet popup shown when a participant taps "Pagar": the owner's
 * transfer details, a one-tap copy, and the self-mark-as-paid toggle. */
export function PayInfoModal({
  visible,
  onClose,
  ownerBank,
  paymentStatus,
  updating,
  onCopy,
  onTogglePaid,
}: PayInfoModalProps) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const bank = ownerBank ?? {};

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <ThemedView style={[styles.sheet, { backgroundColor: card, borderColor: border }]}>
        <ThemedView style={styles.sheetHeader}>
          <ThemedText type="subtitle">Transfiere a</ThemedText>
          <Pressable onPress={onClose} hitSlop={8}>
            <IconSymbol name="xmark" size={22} color={tint} />
          </Pressable>
        </ThemedView>

        <ThemedView style={{ gap: 2 }}>
          <ThemedText type="defaultSemiBold">{bank.full_name}</ThemedText>
          {bank.rut_or_reference ? <ThemedText>RUT: {bank.rut_or_reference}</ThemedText> : null}
          {bank.email ? <ThemedText>Correo: {bank.email}</ThemedText> : null}
          {bank.bank_name ? <ThemedText>Banco: {bank.bank_name}</ThemedText> : null}
          {bank.account_type ? (
            <ThemedText>{ACCOUNT_TYPE_LABELS[bank.account_type] ?? bank.account_type}</ThemedText>
          ) : null}
          {bank.account_number ? <ThemedText>N° {bank.account_number}</ThemedText> : null}
          {!hasBankInfo(bank) ? (
            <ThemedText type="caption">La dueña del evento aún no cargó sus datos bancarios.</ThemedText>
          ) : null}
        </ThemedView>

        {hasBankInfo(bank) ? <Button label="Copiar todos los datos" variant="secondary" onPress={onCopy} /> : null}

        <Button
          label={paymentStatus === 'paid' ? 'Marcar como pendiente' : 'Ya transferí, marcar como pagado'}
          variant={paymentStatus === 'paid' ? 'ghost' : 'primary'}
          loading={updating}
          onPress={onTogglePaid}
        />
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
    gap: Spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
});
