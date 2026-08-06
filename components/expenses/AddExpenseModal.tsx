import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import {
  DEFAULT_EXPENSE_CURRENCY,
  EXPENSE_CURRENCY_OPTIONS,
  validateManualExpenseInput,
} from '@/lib/expenses';
import { tripMemberDisplayName, tripMemberInitials, type TripMember } from '@/lib/trip-members';

export type AddExpenseFormState = {
  title: string;
  amount: string;
  currency: string;
  paidByUserId: string | null;
};

export function emptyAddExpenseForm(defaultPaidBy: string | null): AddExpenseFormState {
  return {
    title: '',
    amount: '',
    currency: DEFAULT_EXPENSE_CURRENCY,
    paidByUserId: defaultPaidBy,
  };
}

type AddExpenseModalProps = {
  visible: boolean;
  saving: boolean;
  saveError: string | null;
  form: AddExpenseFormState;
  members: TripMember[];
  membersLoading: boolean;
  membersError: string | null;
  onChange: (patch: Partial<AddExpenseFormState>) => void;
  onClose: () => void;
  onSave: () => void;
};

export function AddExpenseModal({
  visible,
  saving,
  saveError,
  form,
  members,
  membersLoading,
  membersError,
  onChange,
  onClose,
  onSave,
}: AddExpenseModalProps) {
  const validation = validateManualExpenseInput({
    title: form.title,
    amountRaw: form.amount,
    currency: form.currency,
    paidBy: form.paidByUserId,
  });
  const canSave = validation.ok;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add expense</Text>
            <Pressable accessibilityRole="button" disabled={saving} hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <PeakInput
              editable={!saving}
              label="Expense title"
              placeholder="Dinner at the market"
              value={form.title}
              onChangeText={(title) => onChange({ title })}
              autoCapitalize="sentences"
              returnKeyType="next"
            />

            <PeakInput
              editable={!saving}
              keyboardType="decimal-pad"
              label="Amount"
              placeholder="0.00"
              value={form.amount}
              onChangeText={(amount) => onChange({ amount })}
            />

            <Text style={styles.fieldLabel}>Currency</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.currencyRow}>
              {EXPENSE_CURRENCY_OPTIONS.map((code) => {
                const selected = form.currency === code;
                return (
                  <Pressable
                    key={code}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={saving}
                    onPress={() => onChange({ currency: code })}
                    style={[styles.currencyChip, selected && styles.currencyChipSelected]}>
                    <Text style={[styles.currencyChipText, selected && styles.currencyChipTextSelected]}>
                      {code}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>Paid by</Text>
            {membersLoading ? (
              <Text style={styles.membersEmpty}>Loading trip members…</Text>
            ) : membersError ? (
              <Text style={styles.membersError}>{membersError}</Text>
            ) : members.length === 0 ? (
              <Text style={styles.membersEmpty}>
                No trip members found. Confirm you belong to this space.
              </Text>
            ) : (
              <View style={styles.memberList}>
                {members.map((member) => {
                  const selected = form.paidByUserId === member.userId;
                  return (
                    <Pressable
                      key={member.userId}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      disabled={saving}
                      onPress={() => onChange({ paidByUserId: member.userId })}
                      style={[styles.memberRow, selected && styles.memberRowSelected]}>
                      <View style={[styles.memberAvatar, selected && styles.memberAvatarSelected]}>
                        <Text style={styles.memberAvatarText}>{tripMemberInitials(member)}</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{tripMemberDisplayName(member)}</Text>
                        <Text style={styles.memberRole}>{member.role === 'owner' ? 'Owner' : 'Member'}</Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={24} color={PeakColors.primary} />
                      ) : (
                        <View style={styles.radioOuter} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <PeakButton
              fullWidth
              title="Cancel"
              variant="outline"
              disabled={saving}
              onPress={onClose}
              style={styles.footerButton}
            />
            <PeakButton
              fullWidth
              loading={saving}
              title="Save"
              disabled={!canSave || saving}
              onPress={onSave}
              style={styles.footerButton}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PeakColors.border,
  },
  headerTitle: {
    ...Typography.h2,
  },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  fieldLabel: {
    ...Typography.label,
    marginBottom: -Spacing.sm,
  },
  currencyRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  currencyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  currencyChipSelected: {
    borderColor: PeakColors.primary,
    backgroundColor: PeakColors.primaryLight,
  },
  currencyChipText: {
    ...Typography.label,
    color: PeakColors.textSecondary,
  },
  currencyChipTextSelected: {
    color: PeakColors.primaryDark,
  },
  membersEmpty: {
    ...Typography.bodySmall,
    fontStyle: 'italic',
    color: PeakColors.textMuted,
  },
  membersError: {
    ...Typography.bodySmall,
    color: PeakColors.error,
  },
  memberList: {
    gap: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  memberRowSelected: {
    borderColor: PeakColors.primary,
    backgroundColor: PeakColors.primaryLight,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.pill,
    backgroundColor: PeakColors.aquaLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarSelected: {
    backgroundColor: PeakColors.surface,
  },
  memberAvatarText: {
    ...Typography.caption,
    fontWeight: '800',
    color: PeakColors.navy,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...Typography.label,
  },
  memberRole: {
    ...Typography.caption,
    marginTop: 2,
    color: PeakColors.textSecondary,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.pill,
    borderWidth: 2,
    borderColor: PeakColors.borderStrong,
  },
  saveError: {
    ...Typography.bodySmall,
    color: PeakColors.error,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PeakColors.border,
    backgroundColor: PeakColors.background,
  },
  footerButton: {
    flex: 1,
  },
});
