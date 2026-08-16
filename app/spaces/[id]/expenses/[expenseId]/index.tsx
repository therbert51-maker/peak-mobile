import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseSettlementSummary } from '@/components/expenses/ExpenseSettlementSummary';
import { ExpenseSplitSummary } from '@/components/expenses/ExpenseSplitSummary';
import { ItemAssignmentModal } from '@/components/expenses/ItemAssignmentModal';
import { ReceiptImageViewer } from '@/components/expenses/ReceiptImageViewer';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakCard } from '@/components/ui/PeakCard';
import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import {
  assignmentRowsToSelections,
  fetchExpenseItemAssignments,
  fetchExpenseParticipants,
  saveExpenseSplit,
} from '@/lib/expense-split-api';
import { deriveExpenseSettlement } from '@/lib/expense-settlement';
import {
  calculateExpenseSplit,
  type ExpenseItemSelections,
} from '@/lib/expense-split';
import { formatExpenseAmount } from '@/lib/expenses';
import {
  tripMemberDisplayName,
  type TripMember,
} from '@/lib/trip-members';
import {
  deleteExpenseAndReceipt,
  fetchExpenseForReview,
  fetchExpenseItems,
  signedReceiptImageUrl,
} from '@/lib/receipt/receipt-api';
import { useTripMembers } from '@/hooks/use-trip-members';
import { supabase } from '@/lib/supabase';
import type { Expense, ExpenseItem, ExpenseParticipant } from '@/types/database';

const PARTICIPANT_READ_ERROR =
  'Item assignments saved, but participant shares could not be loaded. Run migration 011 in Supabase, then save the split again.';

export default function ExpenseDetailScreen() {
  const { user } = useAuth();
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const spaceId = Array.isArray(id) ? id[0] : id;
  const expenseIdValue = Array.isArray(expenseId) ? expenseId[0] : expenseId;

  const [expense, setExpense] = useState<Expense | null>(null);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selections, setSelections] = useState<ExpenseItemSelections>({});
  const [selectedItem, setSelectedItem] = useState<ExpenseItem | null>(null);
  const [savingSplit, setSavingSplit] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [splitSaved, setSplitSaved] = useState(false);
  const [savedParticipants, setSavedParticipants] = useState<ExpenseParticipant[]>([]);

  const {
    members,
    loadState: membersLoadState,
    errorMessage: membersError,
    refresh: refreshMembers,
  } = useTripMembers(spaceId, ownerId, { refreshOnFocus: true });
  const membersById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  const load = useCallback(async () => {
    if (!expenseIdValue || !spaceId) return;
    setLoading(true);
    setErrorMessage(null);
    setSplitError(null);
    setSplitSaved(false);
    setSavedParticipants([]);

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

    const loadedItems = itemsResult.data ?? [];
    const [assignmentsResult, participantsResult] = await Promise.all([
      fetchExpenseItemAssignments(loadedItems.map((item) => item.id)),
      fetchExpenseParticipants(expenseIdValue),
    ]);
    const persistedParticipants = participantsResult.data ?? [];
    const persistedAssignments = assignmentsResult.data ?? [];

    if (__DEV__) {
      console.info('[expense-split] Loaded persisted split', {
        expenseId: expenseIdValue,
        assignmentCount: persistedAssignments.length,
        participantCount: persistedParticipants.length,
        assignmentsError: assignmentsResult.error,
        participantsError: participantsResult.error,
      });
    }

    setExpense(expenseResult.data);
    setItems(loadedItems);
    setSelections(assignmentRowsToSelections(persistedAssignments));
    setSavedParticipants(persistedParticipants);
    setOwnerId(spaceResult.data?.owner_id ?? null);
    setErrorMessage(itemsResult.error?.message ?? null);
    setSplitError(
      assignmentsResult.error ??
        participantsResult.error ??
        (persistedAssignments.length > 0 && persistedParticipants.length === 0
          ? PARTICIPANT_READ_ERROR
          : null),
    );
    setSplitSaved(persistedParticipants.length > 0);

    if (expenseResult.data.receipt_image_path) {
      setReceiptUrl(await signedReceiptImageUrl(expenseResult.data.receipt_image_path));
    } else {
      setReceiptUrl(null);
    }

    setLoading(false);
  }, [expenseIdValue, spaceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const validSelections = useMemo(() => {
    const activeMemberIds = new Set(members.map((member) => member.userId));
    return Object.fromEntries(
      Object.entries(selections).map(([itemId, userIds]) => [
        itemId,
        userIds.filter((userId) => activeMemberIds.has(userId)),
      ]),
    );
  }, [members, selections]);

  const splitCalculation = useMemo(() => {
    if (!expense || items.length === 0) return null;
    return calculateExpenseSplit({
      expense,
      items,
      selections: validSelections,
    });
  }, [expense, items, validSelections]);

  const settlement = useMemo(() => {
    if (!splitSaved || !expense) return null;
    return deriveExpenseSettlement({
      payerId: expense.paid_by,
      expenseTotal: Number(expense.total),
      participants: savedParticipants,
    });
  }, [expense, savedParticipants, splitSaved]);

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
  const canManage = Boolean(user?.id && expense.created_by === user.id);

  const assignmentLabel = (item: ExpenseItem): string => {
    const assignedIds = validSelections[item.id] ?? [];
    if (assignedIds.length === 0) return 'Unassigned';
    if (members.length > 0 && assignedIds.length === members.length) return 'Everyone';
    return assignedIds
      .map((userId) => membersById.get(userId))
      .filter((member): member is TripMember => Boolean(member))
      .map(tripMemberDisplayName)
      .join(', ');
  };

  const updateItemAssignments = (userIds: string[]) => {
    if (!selectedItem) return;
    setSelections((current) => ({ ...current, [selectedItem.id]: userIds }));
    setSelectedItem(null);
    setSplitError(null);
    setSplitSaved(false);
  };

  const handleSaveSplit = async () => {
    if (!expenseIdValue || !splitCalculation || savingSplit) return;
    if (!splitCalculation.isFullyAssigned) {
      setSplitError('Assign every receipt item before saving the split.');
      return;
    }

    setSavingSplit(true);
    setSplitError(null);
    setSplitSaved(false);
    const result = await saveExpenseSplit({
      expenseId: expenseIdValue,
      assignments: splitCalculation.assignments,
      participants: splitCalculation.participants,
    });

    if (!result.ok) {
      setSavingSplit(false);
      setSplitError(result.error ?? 'Could not save this split.');
      return;
    }

    const [persistedAssignments, persistedParticipants] = await Promise.all([
      fetchExpenseItemAssignments(items.map((item) => item.id)),
      fetchExpenseParticipants(expenseIdValue),
    ]);
    if (
      persistedAssignments.error ||
      !persistedAssignments.data ||
      persistedParticipants.error ||
      !persistedParticipants.data
    ) {
      setSavingSplit(false);
      setSplitError(
        persistedAssignments.error ??
          persistedParticipants.error ??
          'Split saved, but could not refresh it.',
      );
      return;
    }

    if (persistedAssignments.data.length === 0) {
      setSavingSplit(false);
      setSplitError('Split saved, but item assignments could not be read back.');
      return;
    }

    if (persistedParticipants.data.length === 0) {
      setSavingSplit(false);
      setSplitError(PARTICIPANT_READ_ERROR);
      return;
    }

    if (__DEV__) {
      console.info('[expense-split] Verified persisted split after save', {
        expenseId: expenseIdValue,
        assignmentCount: persistedAssignments.data.length,
        participantCount: persistedParticipants.data.length,
      });
    }

    setSelections(assignmentRowsToSelections(persistedAssignments.data));
    setSavedParticipants(persistedParticipants.data);
    setSavingSplit(false);
    setSplitSaved(true);
  };

  const performDelete = async () => {
    if (!expenseIdValue || !spaceId || deleting) return;
    setDeleting(true);
    setErrorMessage(null);

    const result = await deleteExpenseAndReceipt(expenseIdValue);
    setDeleting(false);

    if (!result.ok) {
      setErrorMessage(result.error ?? 'Could not delete this expense.');
      return;
    }

    const navigateToExpenses = () =>
      router.replace({ pathname: '/spaces/[id]/expenses', params: { id: spaceId } });

    if (result.cleanupWarning) {
      Alert.alert('Expense deleted', result.cleanupWarning, [
        { text: 'OK', onPress: navigateToExpenses },
      ]);
      return;
    }

    navigateToExpenses();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete expense?',
      'This permanently deletes the expense, receipt image, and processing data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void performDelete() },
      ],
    );
  };

  const openReceiptViewer = async () => {
    if (!expense.receipt_image_path) return;
    const freshUrl = await signedReceiptImageUrl(expense.receipt_image_path);
    if (!freshUrl) {
      setErrorMessage('Could not open the receipt image. Please try again.');
      return;
    }
    setReceiptUrl(freshUrl);
    setImageViewerVisible(true);
  };

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

        {receiptUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View full receipt"
            onPress={() => void openReceiptViewer()}
            style={styles.receiptButton}>
            <Image source={{ uri: receiptUrl }} style={styles.receiptImage} contentFit="cover" />
            <View style={styles.expandBadge}>
              <Ionicons name="expand-outline" size={18} color={PeakColors.textInverse} />
              <Text style={styles.expandText}>View receipt</Text>
            </View>
          </Pressable>
        ) : null}

        {items.length > 0 ? (
          <View style={styles.section}>
            <View>
              <Text style={styles.sectionTitle}>Assign items</Text>
              <Text style={styles.sectionSubtitle}>
                Tap an item to choose who shared it.
              </Text>
            </View>
            {items.map((item) => {
              const assigned = (validSelections[item.id] ?? []).length > 0;
              return (
                <PeakCard
                  key={item.id}
                  onPress={
                    membersLoadState === 'success' && members.length > 0
                      ? () => setSelectedItem(item)
                      : undefined
                  }
                  padding="md"
                  style={[styles.itemCard, assigned && styles.itemCardAssigned]}>
                  <View style={styles.itemTopRow}>
                    <View style={styles.itemText}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>
                        Qty {Number(item.quantity)}
                        {item.unit_price !== null
                          ? ` × ${formatExpenseAmount(
                              Number(item.unit_price),
                              expense.original_currency,
                            )}`
                          : ''}
                        {' · '}
                        {formatExpenseAmount(
                          Number(item.line_total),
                          expense.original_currency,
                        )}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={PeakColors.textMuted}
                    />
                  </View>
                  <View style={styles.assignmentRow}>
                    <Ionicons
                      name={assigned ? 'people' : 'person-add-outline'}
                      size={16}
                      color={assigned ? PeakColors.primary : PeakColors.textMuted}
                    />
                    <Text
                      style={[styles.assignmentText, !assigned && styles.assignmentUnassigned]}
                      numberOfLines={2}>
                      {assignmentLabel(item)}
                    </Text>
                  </View>
                </PeakCard>
              );
            })}
          </View>
        ) : null}

        {splitCalculation ? (
          <>
            <ExpenseSplitSummary
              calculation={splitCalculation}
              currency={expense.original_currency}
              membersById={membersById}
            />
            {membersLoadState === 'loading' ? (
              <Text style={styles.splitHint}>Loading Space members…</Text>
            ) : membersError ? (
              <View style={styles.memberError}>
                <Text style={styles.splitError}>{membersError}</Text>
                <PeakButton
                  title="Retry members"
                  variant="outline"
                  onPress={() => void refreshMembers()}
                />
              </View>
            ) : members.length === 0 ? (
              <Text style={styles.splitError}>
                Add members to this Space before splitting a receipt.
              </Text>
            ) : !splitCalculation.isFullyAssigned ? (
              <Text style={styles.splitHint}>
                Assign every item to enable saving.
              </Text>
            ) : null}
            {splitError ? <Text style={styles.splitError}>{splitError}</Text> : null}
            {splitSaved ? <Text style={styles.splitSuccess}>Split saved</Text> : null}
            <PeakButton
              fullWidth
              loading={savingSplit}
              disabled={
                savingSplit ||
                membersLoadState === 'loading' ||
                members.length === 0 ||
                !splitCalculation.isFullyAssigned
              }
              title="Save split"
              onPress={() => void handleSaveSplit()}
            />
          </>
        ) : null}

        {settlement ? (
          <ExpenseSettlementSummary
            settlement={settlement}
            currency={expense.original_currency}
            membersById={membersById}
          />
        ) : null}

        {canManage ? (
          <PeakButton
            title={expense.receipt_status === 'needs_review' ? 'Continue review' : 'Edit expense'}
            onPress={() =>
              router.push({
                pathname: '/spaces/[id]/expenses/[expenseId]/review',
                params: { id: spaceId!, expenseId: expenseIdValue! },
              })
            }
          />
        ) : null}

        {canManage ? (
          <Pressable
            accessibilityRole="button"
            disabled={deleting}
            onPress={confirmDelete}
            style={styles.deleteButton}>
            <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete expense'}</Text>
          </Pressable>
        ) : null}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </ScrollView>

      <ReceiptImageViewer
        visible={imageViewerVisible}
        imageUrl={receiptUrl}
        onClose={() => setImageViewerVisible(false)}
      />
      <ItemAssignmentModal
        visible={selectedItem !== null}
        itemName={selectedItem?.name ?? ''}
        members={members}
        selectedUserIds={selectedItem ? (validSelections[selectedItem.id] ?? []) : []}
        onClose={() => setSelectedItem(null)}
        onSave={updateItemAssignments}
      />
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
  sectionSubtitle: { ...Typography.bodySmall, marginTop: 2 },
  receiptButton: { position: 'relative' },
  receiptImage: { width: '100%', height: 220, borderRadius: BorderRadius.medium },
  expandBadge: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  expandText: { ...Typography.caption, color: PeakColors.textInverse, fontWeight: '700' },
  itemCard: { marginBottom: Spacing.sm },
  itemCardAssigned: { borderColor: PeakColors.primaryMuted },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemText: { flex: 1, minWidth: 0 },
  itemName: { ...Typography.label },
  itemMeta: { ...Typography.caption, marginTop: 4 },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PeakColors.border,
  },
  assignmentText: { ...Typography.bodySmall, flex: 1, color: PeakColors.primaryDark },
  assignmentUnassigned: { color: PeakColors.textMuted, fontStyle: 'italic' },
  splitHint: { ...Typography.caption, color: PeakColors.textSecondary, textAlign: 'center' },
  splitError: { ...Typography.bodySmall, color: PeakColors.error, textAlign: 'center' },
  memberError: { gap: Spacing.sm, alignItems: 'center' },
  splitSuccess: {
    ...Typography.bodySmall,
    color: PeakColors.success,
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  deleteText: { ...Typography.label, color: PeakColors.error },
  error: { ...Typography.bodySmall, textAlign: 'center', margin: Spacing.xl },
});
