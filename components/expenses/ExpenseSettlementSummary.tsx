import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { PeakCard } from '@/components/ui/PeakCard';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import type { ExpenseSettlementSummary as Settlement } from '@/lib/expense-settlement';
import { formatExpenseAmount } from '@/lib/expenses';
import {
  tripMemberDisplayName,
  tripMemberInitials,
  type TripMember,
} from '@/lib/trip-members';

type ExpenseSettlementSummaryProps = {
  settlement: Settlement;
  currency: string;
  membersById: Map<string, TripMember>;
};

function displayName(userId: string, membersById: Map<string, TripMember>): string {
  const member = membersById.get(userId);
  if (!member) return 'Former member';
  const name = tripMemberDisplayName(member);
  return name === 'Member' ? `Member ${tripMemberInitials(member)}` : name;
}

function MemberAvatar({
  userId,
  membersById,
}: {
  userId: string;
  membersById: Map<string, TripMember>;
}) {
  const member = membersById.get(userId);
  const avatarUrl = member?.profile?.avatar_url;

  return (
    <Avatar
      size="sm"
      initials={member ? tripMemberInitials(member) : userId.replace(/-/g, '').slice(0, 2)}
      source={avatarUrl ? { uri: avatarUrl } : undefined}
      backgroundColor={PeakColors.navy}
    />
  );
}

export function ExpenseSettlementSummary({
  settlement,
  currency,
  membersById,
}: ExpenseSettlementSummaryProps) {
  const payerName = displayName(settlement.payerId, membersById);

  return (
    <PeakCard padding="md">
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <Ionicons name="swap-horizontal" size={20} color={PeakColors.primary} />
        </View>
        <View style={styles.headingText}>
          <Text style={styles.title}>Who owes who</Text>
          <Text style={styles.subtitle}>For this expense only</Text>
        </View>
      </View>

      <View style={styles.payerCard}>
        <MemberAvatar userId={settlement.payerId} membersById={membersById} />
        <View style={styles.payerText}>
          <Text style={styles.payerName}>{payerName}</Text>
          <Text style={styles.payerLabel}>Paid the expense</Text>
        </View>
        <Text style={styles.paidAmount}>
          {formatExpenseAmount(settlement.paidAmount, currency)}
        </Text>
      </View>

      <View style={styles.debtors}>
        {settlement.debtors.length === 0 ? (
          <Text style={styles.empty}>No one owes {payerName} for this expense.</Text>
        ) : (
          settlement.debtors.map((debtor) => (
            <View key={debtor.userId} style={styles.debtorRow}>
              <MemberAvatar userId={debtor.userId} membersById={membersById} />
              <Text style={styles.debtorText}>
                <Text style={styles.debtorName}>
                  {displayName(debtor.userId, membersById)}
                </Text>
                {' owes '}
                {payerName}
              </Text>
              <Text style={styles.debtorAmount}>
                {formatExpenseAmount(debtor.amount, currency)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.divider} />
      <View style={styles.totalRow}>
        <View>
          <Text style={styles.totalLabel}>{payerName} is owed</Text>
          <Text style={styles.shareLabel}>
            {`${payerName}'s share ${formatExpenseAmount(settlement.payerShare, currency)}`}
          </Text>
        </View>
        <Text style={styles.totalAmount}>
          {formatExpenseAmount(settlement.amountOwedToPayer, currency)}
        </Text>
      </View>
    </PeakCard>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headingIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.primaryLight,
  },
  headingText: { flex: 1 },
  title: { ...Typography.h3 },
  subtitle: { ...Typography.caption, marginTop: 1 },
  payerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.surfaceMuted,
  },
  payerText: { flex: 1, minWidth: 0 },
  payerName: { ...Typography.label },
  payerLabel: { ...Typography.caption, marginTop: 1 },
  paidAmount: {
    ...Typography.label,
    color: PeakColors.navy,
    fontVariant: ['tabular-nums'],
  },
  debtors: { gap: Spacing.md, marginTop: Spacing.md },
  debtorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  debtorText: { ...Typography.bodySmall, flex: 1 },
  debtorName: { fontWeight: '700', color: PeakColors.textPrimary },
  debtorAmount: {
    ...Typography.label,
    color: PeakColors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    ...Typography.bodySmall,
    color: PeakColors.textSecondary,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PeakColors.border,
    marginVertical: Spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  totalLabel: { ...Typography.label, color: PeakColors.navy },
  shareLabel: { ...Typography.caption, marginTop: 2 },
  totalAmount: {
    ...Typography.h3,
    color: PeakColors.success,
    fontVariant: ['tabular-nums'],
  },
});
