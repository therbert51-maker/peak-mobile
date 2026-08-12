import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakCard } from '@/components/ui/PeakCard';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { formatExpenseAmount } from '@/lib/expenses';
import { fetchExpenseForReview, fetchExpenseItems } from '@/lib/receipt/receipt-api';
import { useTripMembers } from '@/hooks/use-trip-members';
import { tripMemberDisplayName } from '@/lib/trip-members';
import { supabase } from '@/lib/supabase';
import type { Expense, ExpenseItem } from '@/types/database';

export default function ExpenseDetailScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const spaceId = Array.isArray(id) ? id[0] : id;
  const expenseIdValue = Array.isArray(expenseId) ? expenseId[0] : expenseId;

  const [expense, setExpense] = useState<Expense | null>(null);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { members } = useTripMembers(spaceId, ownerId);
  const membersById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  const load = useCallback(async () => {
    if (!expenseIdValue || !spaceId) return;
    setLoading(true);

    const [expenseResult, itemsResult, spaceResult] = await Promise.all([
      fetchExpenseForReview(expenseIdValue),
      fetchExpenseItems(expenseIdValue),
      supabase.from('spaces').select('owner_id').eq('id', spaceId).maybeSingle(),
    ]);

    if (expenseResult.error || !expenseResult.data) {
      setErrorMessage(expenseResult.error?.message ?? 'Could not load expense.');
      setLoading(false);
      return;
    }

    setExpense(expenseResult.data);
    setItems(itemsResult.data ?? []);
    setOwnerId(spaceResult.data?.owner_id ?? null);
    setLoading(false);
  }, [expenseIdValue, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator style={styles.loader} color={PeakColors.primary} />
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.error}>{errorMessage ?? 'Expense not found.'}</Text>
        <PeakButton title="Go back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const payer = expense.paid_by ? membersById.get(expense.paid_by) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={PeakColors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Expense</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <PeakCard padding="md">
          <Text style={styles.title}>{expense.expense_title}</Text>
          {expense.merchant_name ? <Text style={styles.merchant}>{expense.merchant_name}</Text> : null}
          <Text style={styles.amount}>
            {formatExpenseAmount(Number(expense.total), expense.original_currency)}
          </Text>
          <Text style={styles.meta}>
            Paid by {payer ? tripMemberDisplayName(payer) : 'Unknown'} · Status: {expense.receipt_status}
          </Text>
          {expense.display_currency && expense.display_currency !== expense.original_currency ? (
            <Text style={styles.meta}>
              Display currency: {expense.display_currency} (conversion coming soon)
            </Text>
          ) : null}
        </PeakCard>

        {items.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            {items.map((item) => (
              <PeakCard key={item.id} padding="md" style={styles.itemCard}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} × {item.unit_price ?? '—'} = {formatExpenseAmount(Number(item.line_total), expense.original_currency)}
                </Text>
              </PeakCard>
            ))}
          </View>
        ) : null}

        {expense.receipt_status === 'needs_review' ? (
          <PeakButton
            title="Continue review"
            onPress={() =>
              router.push({
                pathname: '/spaces/[id]/expenses/[expenseId]/review',
                params: { id: spaceId!, expenseId: expenseIdValue! },
              })
            }
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PeakColors.background },
  loader: { marginTop: Spacing.xxl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  topTitle: { ...Typography.h3, flex: 1, textAlign: 'center' },
  spacer: { width: 24 },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  title: { ...Typography.h2 },
  merchant: { ...Typography.bodySmall, color: PeakColors.textSecondary, marginTop: 4 },
  amount: { ...Typography.h1, marginTop: Spacing.sm },
  meta: { ...Typography.caption, marginTop: Spacing.sm, color: PeakColors.textSecondary },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.h3 },
  itemCard: { marginBottom: Spacing.sm },
  itemName: { ...Typography.label },
  itemMeta: { ...Typography.caption, marginTop: 4 },
  error: { ...Typography.bodySmall, textAlign: 'center', margin: Spacing.xl },
});
