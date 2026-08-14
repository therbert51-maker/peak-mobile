import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PeakCard } from '@/components/ui/PeakCard';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { formatExpenseAmount } from '@/lib/expenses';
import { colorBackground } from '@/lib/space-colors';
import type { SplitSpaceSummary } from '@/lib/split-hub';
import { formatTripDateRange } from '@/lib/trip-dates';

type SplitSpaceCardProps = {
  summary: SplitSpaceSummary;
  onPress: () => void;
};

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function SplitSpaceCard({ summary, onPress }: SplitSpaceCardProps) {
  const { space, totals, expenseCount, memberCount } = summary;
  const dates = formatTripDateRange(space.start_date, space.end_date);

  return (
    <PeakCard onPress={onPress} padding="md" style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.emojiWrap, { backgroundColor: colorBackground(space.color) }]}>
          <Text style={styles.emoji}>{space.emoji}</Text>
        </View>
        <View style={styles.heading}>
          <Text style={styles.name} numberOfLines={2}>
            {space.name}
          </Text>
          {dates ? (
            <View style={styles.metadataRow}>
              <Ionicons name="calendar-outline" size={14} color={PeakColors.textSecondary} />
              <Text style={styles.metadata} numberOfLines={1}>
                {dates}
              </Text>
            </View>
          ) : space.destination ? (
            <View style={styles.metadataRow}>
              <Ionicons name="location-outline" size={14} color={PeakColors.textSecondary} />
              <Text style={styles.metadata} numberOfLines={1}>
                {space.destination}
              </Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={PeakColors.textMuted} />
      </View>

      <View style={styles.divider} />

      <View style={styles.summaryRow}>
        <View style={styles.totalBlock}>
          <Text style={styles.label}>Trip total</Text>
          {totals.length === 0 ? (
            <Text style={styles.noExpenses}>No expenses yet</Text>
          ) : (
            <View style={styles.totals}>
              {totals.map(({ amount, currency }) => (
                <Text key={currency} style={styles.total}>
                  {formatExpenseAmount(amount, currency)} {currency}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.counts}>
          <View style={styles.countRow}>
            <Ionicons name="receipt-outline" size={16} color={PeakColors.primary} />
            <Text style={styles.countText}>{countLabel(expenseCount, 'expense')}</Text>
          </View>
          <View style={styles.countRow}>
            <Ionicons name="people-outline" size={16} color={PeakColors.primary} />
            <Text style={styles.countText}>{countLabel(memberCount, 'member')}</Text>
          </View>
        </View>
      </View>
    </PeakCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emojiWrap: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  heading: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...Typography.h3,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  metadata: {
    ...Typography.caption,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PeakColors.border,
    marginVertical: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  totalBlock: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  totals: {
    gap: 2,
  },
  total: {
    ...Typography.h3,
    color: PeakColors.navy,
    fontVariant: ['tabular-nums'],
  },
  noExpenses: {
    ...Typography.bodySmall,
    color: PeakColors.textMuted,
    fontStyle: 'italic',
  },
  counts: {
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  countText: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
  },
});
