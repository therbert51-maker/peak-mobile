import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PeakCard } from '@/components/ui/PeakCard';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';
import { formatExpenseAmount, type ManualExpense } from '@/lib/expenses';
import { tripMemberDisplayName, type TripMember } from '@/lib/trip-members';

type ExpenseListItemProps = {
  expense: ManualExpense;
  membersById: Map<string, TripMember>;
};

function formatExpenseDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function ExpenseListItem({ expense, membersById }: ExpenseListItemProps) {
  const payer = expense.paidBy ? membersById.get(expense.paidBy) : null;
  const paidByLabel = payer ? tripMemberDisplayName(payer) : 'Unknown';

  return (
    <PeakCard padding="md" style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="receipt-outline" size={22} color={PeakColors.primary} />
        </View>
        <View style={styles.main}>
          <Text style={styles.title} numberOfLines={2}>
            {expense.title}
          </Text>
          <Text style={styles.meta}>
            Paid by {paidByLabel} · {formatExpenseDate(expense.createdAt)}
          </Text>
        </View>
        <Text style={styles.amount}>{formatExpenseAmount(expense.amount, expense.currency)}</Text>
      </View>
    </PeakCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: PeakColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...Typography.label,
  },
  meta: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    marginTop: 4,
  },
  amount: {
    ...Typography.label,
    color: PeakColors.navy,
    fontVariant: ['tabular-nums'],
  },
});
