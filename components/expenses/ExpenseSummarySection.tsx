import { StyleSheet, Text, View } from 'react-native';

import { PeakCard } from '@/components/ui/PeakCard';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { formatExpenseAmount } from '@/lib/expenses';
import type { ExpenseSummary } from '@/lib/expense-summary';
import { tripMemberDisplayName, tripMemberInitials, type TripMember } from '@/lib/trip-members';

type ExpenseSummarySectionProps = {
  summary: ExpenseSummary;
};

function MemberAvatar({ member }: { member: TripMember | null }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>
        {member ? tripMemberInitials(member) : '?'}
      </Text>
    </View>
  );
}

function CurrencyAmounts({
  totals,
  amountStyle,
}: {
  totals: { currency: string; amount: number }[];
  amountStyle?: object;
}) {
  if (totals.length === 0) {
    return <Text style={[styles.amountMuted, amountStyle]}>—</Text>;
  }

  return (
    <View style={styles.amountStack}>
      {totals.map((total) => (
        <Text key={total.currency} style={[styles.amount, amountStyle]}>
          {formatExpenseAmount(total.amount, total.currency)}
        </Text>
      ))}
    </View>
  );
}

export function ExpenseSummarySection({ summary }: ExpenseSummarySectionProps) {
  const { tripTotals, memberTotals, includedExpenseCount } = summary;
  const singleCurrency = tripTotals.length === 1 ? tripTotals[0] : null;

  return (
    <PeakCard padding="md" style={styles.card}>
      <Text style={styles.sectionLabel}>Trip total</Text>
      {includedExpenseCount === 0 ? (
        <Text style={styles.emptySummary}>
          No completed expenses yet. Processing and failed scans are excluded.
        </Text>
      ) : singleCurrency ? (
        <Text style={styles.tripTotalSingle}>
          {formatExpenseAmount(singleCurrency.amount, singleCurrency.currency)}
        </Text>
      ) : (
        <View style={styles.tripTotalsMulti}>
          {tripTotals.map((total) => (
            <View key={total.currency} style={styles.tripTotalRow}>
              <Text style={styles.currencyCode}>{total.currency}</Text>
              <Text style={styles.tripTotalMultiAmount}>
                {formatExpenseAmount(total.amount, total.currency)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {memberTotals.length > 0 ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Paid by member</Text>
          <View style={styles.memberList}>
            {memberTotals.map((entry) => (
              <View key={entry.userId} style={styles.memberRow}>
                <MemberAvatar member={entry.member} />
                <Text style={styles.memberName} numberOfLines={1}>
                  {entry.member ? tripMemberDisplayName(entry.member) : 'Unknown member'}
                </Text>
                <CurrencyAmounts totals={entry.totalsByCurrency} amountStyle={styles.memberAmount} />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </PeakCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  emptySummary: {
    ...Typography.bodySmall,
    color: PeakColors.textMuted,
    fontStyle: 'italic',
  },
  tripTotalSingle: {
    ...Typography.h1,
    fontSize: 28,
    color: PeakColors.navy,
    fontVariant: ['tabular-nums'],
  },
  tripTotalsMulti: {
    gap: Spacing.xs,
  },
  tripTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  currencyCode: {
    ...Typography.label,
    color: PeakColors.textSecondary,
    minWidth: 40,
  },
  tripTotalMultiAmount: {
    ...Typography.h3,
    color: PeakColors.navy,
    fontVariant: ['tabular-nums'],
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PeakColors.border,
    marginVertical: Spacing.md,
  },
  memberList: {
    gap: Spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.pill,
    backgroundColor: PeakColors.aquaLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.caption,
    fontWeight: '800',
    color: PeakColors.navy,
  },
  memberName: {
    ...Typography.bodySmall,
    flex: 1,
    minWidth: 0,
  },
  amountStack: {
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    ...Typography.label,
    color: PeakColors.navy,
    fontVariant: ['tabular-nums'],
  },
  memberAmount: {
    ...Typography.bodySmall,
  },
  amountMuted: {
    ...Typography.bodySmall,
    color: PeakColors.textMuted,
  },
});
