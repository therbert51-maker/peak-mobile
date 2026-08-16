import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { PeakCard } from '@/components/ui/PeakCard';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { formatExpenseAmount } from '@/lib/expenses';
import type { MemberCurrencyBalance, TripBalanceSummary } from '@/lib/trip-balances';
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

function formatNet(amount: number, currency: string): string {
  if (amount === 0) return formatExpenseAmount(0, currency);
  const prefix = amount > 0 ? '+' : '−';
  return `${prefix}${formatExpenseAmount(Math.abs(amount), currency)}`;
}

function netStyle(net: number) {
  if (net > 0) return styles.netPositive;
  if (net < 0) return styles.netNegative;
  return styles.netNeutral;
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
        <Text
          style={[styles.netAmount, netStyle(memberBalance.net)]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}>
          {formatNet(memberBalance.net, currency)}
        </Text>
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
                  <View
                    key={`${transfer.fromUserId}-${transfer.toUserId}-${index}`}
                    style={styles.transferRow}>
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
                  </View>
                ))}
              </View>
            )}
          </View>
        ))
      )}
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
  netAmount: {
    ...Typography.h3,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
    textAlign: 'right',
    maxWidth: '42%',
  },
  netPositive: {
    color: PeakColors.success,
  },
  netNegative: {
    color: PeakColors.error,
  },
  netNeutral: {
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
