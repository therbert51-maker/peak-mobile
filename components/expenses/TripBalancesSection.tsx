import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { PeakCard } from '@/components/ui/PeakCard';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { formatExpenseAmount } from '@/lib/expenses';
import type { MemberCurrencyBalance, TripBalanceSummary } from '@/lib/trip-balances';
import type { SettlementTransfer } from '@/lib/trip-settlement';
import {
  tripMemberDisplayName,
  tripMemberInitials,
  type TripMember,
} from '@/lib/trip-members';

type TripBalancesSectionProps = {
  summary: TripBalanceSummary;
  membersById: Map<string, TripMember>;
  loading?: boolean;
  errorMessage?: string | null;
  onSelectTransfer?: (transfer: SettlementTransfer, currency: string) => void;
};

function memberLabel(userId: string, membersById: Map<string, TripMember>): string {
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
  return (
    <Avatar
      size="sm"
      initials={member ? tripMemberInitials(member) : userId.replace(/-/g, '').slice(0, 2)}
      source={member?.profile?.avatar_url ? { uri: member.profile.avatar_url } : undefined}
      backgroundColor={PeakColors.navy}
    />
  );
}

function formatBalanceAmount(amount: number, currency: string): string {
  if (amount === 0) return formatExpenseAmount(0, currency);
  const prefix = amount > 0 ? '+' : '−';
  return `${prefix}${formatExpenseAmount(Math.abs(amount), currency)}`;
}

function balanceAmountStyle(net: number) {
  if (net > 0) return styles.balancePositive;
  if (net < 0) return styles.balanceNegative;
  return styles.balanceNeutral;
}

function formatSettlementDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function MemberBalanceRow({
  memberBalance,
  currency,
  membersById,
}: {
  memberBalance: MemberCurrencyBalance;
  currency: string;
  membersById: Map<string, TripMember>;
}) {
  return (
    <View style={styles.memberCard}>
      <View style={styles.memberTopRow}>
        <View style={styles.memberIdentity}>
          <MemberAvatar userId={memberBalance.userId} membersById={membersById} />
          <Text style={styles.memberName} numberOfLines={1}>
            {memberLabel(memberBalance.userId, membersById)}
          </Text>
        </View>
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text
            style={[styles.balanceAmount, balanceAmountStyle(memberBalance.net)]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}>
            {formatBalanceAmount(memberBalance.net, currency)}
          </Text>
        </View>
      </View>

      <View style={styles.memberStatsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {formatExpenseAmount(memberBalance.paid, currency)}
          </Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Share</Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {formatExpenseAmount(memberBalance.share, currency)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function TripBalancesSection({
  summary,
  membersById,
  loading = false,
  errorMessage = null,
  onSelectTransfer,
}: TripBalancesSectionProps) {
  return (
    <PeakCard padding="md" style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <Ionicons name="wallet-outline" size={20} color={PeakColors.primary} />
        </View>
        <View style={styles.headingText}>
          <Text style={styles.title}>Trip balances</Text>
          <Text style={styles.subtitle}>
            {summary.finalizedExpenseCount === 0
              ? 'Based on saved expense splits'
              : `${summary.finalizedExpenseCount} finalized ${
                  summary.finalizedExpenseCount === 1 ? 'expense' : 'expenses'
                }`}
          </Text>
        </View>
      </View>

      {loading ? (
        <Text style={styles.empty}>Loading trip balances…</Text>
      ) : errorMessage ? (
        <Text style={styles.error}>{errorMessage}</Text>
      ) : summary.finalizedExpenseCount === 0 ? (
        <Text style={styles.empty}>
          No expenses have finalized splits yet. Assign and save splits on receipt expenses to
          see trip-wide balances.
        </Text>
      ) : (
        summary.currencies.map((currencyBalance) => (
          <View key={currencyBalance.currency} style={styles.currencyBlock}>
            {summary.currencies.length > 1 ? (
              <Text style={styles.currencyHeading}>{currencyBalance.currency}</Text>
            ) : null}

            <View style={styles.memberList}>
              {currencyBalance.members.map((memberBalance) => (
                <MemberBalanceRow
                  key={memberBalance.userId}
                  memberBalance={memberBalance}
                  currency={currencyBalance.currency}
                  membersById={membersById}
                />
              ))}
            </View>

            <View style={styles.divider} />
            <Text style={styles.settleLabel}>Settle up</Text>
            {currencyBalance.transfers.length === 0 ? (
              <Text style={styles.empty}>Everyone is settled in {currencyBalance.currency}.</Text>
            ) : (
              <View style={styles.transferList}>
                {currencyBalance.transfers.map((transfer, index) => (
                  <Pressable
                    key={`${transfer.fromUserId}-${transfer.toUserId}-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark payment from ${memberLabel(
                      transfer.fromUserId,
                      membersById,
                    )} to ${memberLabel(transfer.toUserId, membersById)} as paid`}
                    onPress={() => onSelectTransfer?.(transfer, currencyBalance.currency)}
                    style={({ pressed }) => [
                      styles.transferRow,
                      pressed && styles.transferPressed,
                    ]}>
                    <MemberAvatar userId={transfer.fromUserId} membersById={membersById} />
                    <View style={styles.transferTextWrap}>
                      <Text style={styles.transferText} numberOfLines={2}>
                        <Text style={styles.transferName}>
                          {memberLabel(transfer.fromUserId, membersById)}
                        </Text>
                        {' pays '}
                        <Text style={styles.transferName}>
                          {memberLabel(transfer.toUserId, membersById)}
                        </Text>
                      </Text>
                    </View>
                    <Text style={styles.transferAmount} numberOfLines={1}>
                      {formatExpenseAmount(transfer.amount, currencyBalance.currency)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={PeakColors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ))
      )}

      {summary.completedSettlements.length > 0 ? (
        <View style={styles.history}>
          <View style={styles.divider} />
          <Text style={styles.historyLabel}>Settled</Text>
          <View style={styles.historyList}>
            {summary.completedSettlements.map((settlement) => (
              <View key={settlement.id} style={styles.historyRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={PeakColors.success}
                />
                <View style={styles.historyTextWrap}>
                  <Text style={styles.historyText} numberOfLines={2}>
                    <Text style={styles.historyName}>
                      {memberLabel(settlement.fromUserId, membersById)}
                    </Text>
                    {' paid '}
                    <Text style={styles.historyName}>
                      {memberLabel(settlement.toUserId, membersById)}
                    </Text>
                  </Text>
                  <Text style={styles.historyDate}>
                    {formatSettlementDate(settlement.settledAt)}
                  </Text>
                </View>
                <Text style={styles.historyAmount} numberOfLines={1}>
                  {formatExpenseAmount(settlement.amount, settlement.currency)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </PeakCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
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
  currencyBlock: {
    marginBottom: Spacing.sm,
  },
  currencyHeading: {
    ...Typography.label,
    color: PeakColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  memberList: {
    gap: Spacing.sm,
  },
  memberCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
    gap: Spacing.sm,
  },
  memberTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  memberIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  memberName: {
    ...Typography.label,
    flex: 1,
    minWidth: 0,
  },
  balanceBlock: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '46%',
  },
  balanceLabel: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    fontWeight: '600',
    marginBottom: 1,
  },
  balanceAmount: {
    ...Typography.h3,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  balancePositive: {
    color: PeakColors.success,
  },
  balanceNegative: {
    color: PeakColors.error,
  },
  balanceNeutral: {
    color: PeakColors.textSecondary,
  },
  memberStatsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PeakColors.border,
  },
  statLabel: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    flexShrink: 0,
  },
  statValue: {
    ...Typography.bodySmall,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    color: PeakColors.navy,
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PeakColors.border,
    marginVertical: Spacing.md,
  },
  settleLabel: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  transferList: {
    gap: Spacing.sm,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.small,
  },
  transferPressed: {
    backgroundColor: PeakColors.primaryLight,
  },
  transferTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  transferText: {
    ...Typography.bodySmall,
  },
  transferName: {
    fontWeight: '700',
    color: PeakColors.textPrimary,
  },
  transferAmount: {
    ...Typography.label,
    color: PeakColors.primaryDark,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
    textAlign: 'right',
    minWidth: 72,
  },
  history: {
    marginTop: Spacing.xs,
  },
  historyLabel: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  historyList: {
    gap: Spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  historyTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  historyText: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
  },
  historyName: {
    fontWeight: '700',
    color: PeakColors.textPrimary,
  },
  historyDate: {
    ...Typography.caption,
    color: PeakColors.textMuted,
    marginTop: 1,
  },
  historyAmount: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  empty: {
    ...Typography.bodySmall,
    color: PeakColors.textMuted,
    fontStyle: 'italic',
  },
  error: {
    ...Typography.bodySmall,
    color: PeakColors.error,
  },
});
