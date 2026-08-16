import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { formatExpenseAmount } from '@/lib/expenses';

type SettlementConfirmationModalProps = {
  visible: boolean;
  payerName: string;
  recipientName: string;
  amount: number;
  currency: string;
  saving: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SettlementConfirmationModal({
  visible,
  payerName,
  recipientName,
  amount,
  currency,
  saving,
  errorMessage,
  onCancel,
  onConfirm,
}: SettlementConfirmationModalProps) {
  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onCancel}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Mark as paid</Text>
            <Text style={styles.subtitle}>Confirm this trip settlement</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            disabled={saving}
            hitSlop={12}
            onPress={onCancel}>
            <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.icon}>
            <Ionicons name="checkmark-circle-outline" size={32} color={PeakColors.success} />
          </View>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {formatExpenseAmount(amount, currency)}
          </Text>
          <Text style={styles.currency}>{currency.toUpperCase()}</Text>

          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payer</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {payerName}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Recipient</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {recipientName}
              </Text>
            </View>
          </View>

          <Text style={styles.note}>
            This records a completed payment and updates the remaining trip balances.
          </Text>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        </View>

        <View style={styles.footer}>
          <PeakButton
            fullWidth
            title="Mark as paid"
            loading={saving}
            onPress={onConfirm}
          />
          <PeakButton
            fullWidth
            title="Cancel"
            variant="text"
            disabled={saving}
            onPress={onCancel}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PeakColors.border,
  },
  headerText: { flex: 1 },
  title: { ...Typography.h2 },
  subtitle: { ...Typography.bodySmall, marginTop: 2 },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.successLight,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  amount: {
    ...Typography.display,
    color: PeakColors.navy,
    fontVariant: ['tabular-nums'],
    maxWidth: '100%',
  },
  currency: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  details: {
    alignSelf: 'stretch',
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.surface,
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  detailLabel: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    width: 72,
  },
  detailValue: {
    ...Typography.label,
    flex: 1,
    textAlign: 'right',
  },
  note: {
    ...Typography.bodySmall,
    textAlign: 'center',
    marginTop: Spacing.lg,
    maxWidth: 320,
  },
  error: {
    ...Typography.bodySmall,
    color: PeakColors.error,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  footer: {
    padding: Spacing.lg,
    gap: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PeakColors.border,
  },
});
