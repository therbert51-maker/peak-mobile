import { StyleSheet, Text, View } from 'react-native';

import { PeakCard } from '@/components/ui/PeakCard';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';
import type { ExpenseSplitCalculation } from '@/lib/expense-split';
import { formatExpenseAmount } from '@/lib/expenses';
import { tripMemberDisplayName, type TripMember } from '@/lib/trip-members';

type ExpenseSplitSummaryProps = {
  calculation: ExpenseSplitCalculation;
  currency: string;
  membersById: Map<string, TripMember>;
};

function AmountRow({
  label,
  amount,
  currency,
  strong,
}: {
  label: string;
  amount: number;
  currency: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.amountRow}>
      <Text style={[styles.amountLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.amountValue, strong && styles.strong]}>
        {formatExpenseAmount(amount, currency)}
      </Text>
    </View>
  );
}

export function ExpenseSplitSummary({
  calculation,
  currency,
  membersById,
}: ExpenseSplitSummaryProps) {
  return (
    <PeakCard padding="md">
      <Text style={styles.title}>Split summary</Text>
      <View style={styles.amounts}>
        <AmountRow
          label="Receipt total"
          amount={calculation.receiptTotal}
          currency={currency}
          strong
        />
        <AmountRow label="Assigned" amount={calculation.assignedAmount} currency={currency} />
        <AmountRow
          label="Unassigned"
          amount={calculation.unassignedAmount}
          currency={currency}
        />
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>Member shares</Text>
      {calculation.participants.length === 0 ? (
        <Text style={styles.empty}>Assign an item to see each member’s share.</Text>
      ) : (
        <View style={styles.members}>
          {calculation.participants.map((participant) => {
            const member = membersById.get(participant.userId);
            return (
              <View key={participant.userId} style={styles.memberRow}>
                <View style={styles.memberText}>
                  <Text style={styles.memberName}>
                    {member ? tripMemberDisplayName(member) : 'Former member'}
                  </Text>
                  <Text style={styles.breakdown}>
                    Items {formatExpenseAmount(participant.itemSubtotal, currency)}
                    {participant.taxShare > 0
                      ? ` · Tax ${formatExpenseAmount(participant.taxShare, currency)}`
                      : ''}
                    {participant.tipShare > 0
                      ? ` · Tip ${formatExpenseAmount(participant.tipShare, currency)}`
                      : ''}
                    {participant.feeShare > 0
                      ? ` · Fees ${formatExpenseAmount(participant.feeShare, currency)}`
                      : ''}
                    {participant.discountShare > 0
                      ? ` · Discount −${formatExpenseAmount(participant.discountShare, currency)}`
                      : ''}
                    {participant.adjustment !== 0
                      ? ` · Adjustment ${formatExpenseAmount(participant.adjustment, currency)}`
                      : ''}
                  </Text>
                </View>
                <Text style={styles.memberAmount}>
                  {formatExpenseAmount(participant.totalOwed, currency)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </PeakCard>
  );
}

const styles = StyleSheet.create({
  title: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  amounts: {
    gap: Spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  amountLabel: {
    ...Typography.bodySmall,
  },
  amountValue: {
    ...Typography.label,
    fontVariant: ['tabular-nums'],
  },
  strong: {
    color: PeakColors.navy,
    fontWeight: '800',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PeakColors.border,
    marginVertical: Spacing.md,
  },
  sectionLabel: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  empty: {
    ...Typography.bodySmall,
    color: PeakColors.textMuted,
    fontStyle: 'italic',
  },
  members: {
    gap: Spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  memberText: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    ...Typography.label,
  },
  breakdown: {
    ...Typography.caption,
    marginTop: 2,
  },
  memberAmount: {
    ...Typography.label,
    color: PeakColors.navy,
    fontVariant: ['tabular-nums'],
  },
});
