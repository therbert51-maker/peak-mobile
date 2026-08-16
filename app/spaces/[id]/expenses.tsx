import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AddExpenseModal,
  emptyAddExpenseForm,
  type AddExpenseFormState,
} from '@/components/expenses/AddExpenseModal';
import { AddExpenseChooserModal } from '@/components/expenses/AddExpenseChooserModal';
import { SwipeableExpenseListItem } from '@/components/expenses/SwipeableExpenseListItem';
import { ExpenseSummarySection } from '@/components/expenses/ExpenseSummarySection';
import { TripBalancesSection } from '@/components/expenses/TripBalancesSection';
import { ExpensesEmptyState } from '@/components/expenses/ExpensesEmptyState';
import { PeakButton } from '@/components/ui/PeakButton';
import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import {
  canManageExpense,
  expenseEditRoute,
  expenseOpenRoute,
  navigateBackFromExpenses,
  parseExpensesEntryFrom,
} from '@/lib/expense-routes';
import { computeExpenseSummary } from '@/lib/expense-summary';
import { useSpaceExpenses } from '@/hooks/use-space-expenses';
import { useTripBalances } from '@/hooks/use-trip-balances';
import { useTripMembers } from '@/hooks/use-trip-members';
import { validateManualExpenseInput } from '@/lib/expenses';
import { supabase } from '@/lib/supabase';
import type { Space } from '@/types/database';

export default function SpaceExpensesScreen() {
  const { user } = useAuth();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string | string[] }>();
  const spaceId = Array.isArray(id) ? id[0] : id;
  const entryFrom = parseExpensesEntryFrom(from);

  const handleBack = useCallback(() => {
    navigateBackFromExpenses({ spaceId, from: entryFrom });
  }, [entryFrom, spaceId]);

  const [space, setSpace] = useState<Space | null>(null);
  const [spaceLoading, setSpaceLoading] = useState(true);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  const { expenses, loadState, errorMessage, refresh, addExpense, removeExpense } =
    useSpaceExpenses(spaceId);
  const {
    members,
    loadState: membersLoadState,
    errorMessage: membersError,
    refresh: refreshMembers,
  } = useTripMembers(spaceId, space?.owner_id, { refreshOnFocus: true });
  const {
    summary: tripBalanceSummary,
    loadState: tripBalancesLoadState,
    errorMessage: tripBalancesError,
    refresh: refreshTripBalances,
  } = useTripBalances(spaceId, members);

  const [chooserVisible, setChooserVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<AddExpenseFormState>(() => emptyAddExpenseForm(user?.id ?? null));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [listActionError, setListActionError] = useState<string | null>(null);

  const openSwipeableRef = useRef<Swipeable | null>(null);

  const membersById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const expenseSummary = useMemo(
    () => computeExpenseSummary(expenses, members),
    [expenses, members],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshTripBalances();
    }, [refresh, refreshTripBalances]),
  );

  const loadSpace = useCallback(async () => {
    if (!spaceId) {
      setSpaceError('This trip could not be found.');
      setSpaceLoading(false);
      return;
    }

    setSpaceLoading(true);
    setSpaceError(null);

    const { data, error } = await supabase.from('spaces').select('*').eq('id', spaceId).single();

    setSpaceLoading(false);

    if (error || !data) {
      setSpace(null);
      setSpaceError(error?.message ?? 'Could not load this trip.');
      return;
    }

    setSpace(data);
  }, [spaceId]);

  useEffect(() => {
    void loadSpace();
  }, [loadSpace]);

  const openAddFlow = () => {
    void refreshMembers();
    setChooserVisible(true);
  };

  const openManualModal = () => {
    setChooserVisible(false);
    setForm(emptyAddExpenseForm(user?.id ?? members[0]?.userId ?? null));
    setSaveError(null);
    setModalVisible(true);
  };

  const openScan = (source: 'camera' | 'library') => {
    if (!spaceId) return;
    setChooserVisible(false);
    router.push({
      pathname: '/spaces/[id]/expenses/scan',
      params: { id: spaceId, source },
    });
  };

  useEffect(() => {
    if (!modalVisible || form.paidByUserId || members.length === 0) return;
    setForm((prev) => ({
      ...prev,
      paidByUserId: user?.id ?? members[0]?.userId ?? null,
    }));
  }, [form.paidByUserId, members, modalVisible, user?.id]);

  const closeAddModal = () => {
    if (saving) return;
    setModalVisible(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!spaceId || !user?.id) {
      setSaveError('You must be signed in to save an expense.');
      return;
    }

    const validation = validateManualExpenseInput({
      title: form.title,
      amountRaw: form.amount,
      currency: form.currency,
      paidBy: form.paidByUserId,
    });

    if (!validation.ok) {
      setSaveError(validation.error);
      return;
    }

    setSaveError(null);
    setSaving(true);

    const result = await addExpense({
      spaceId,
      title: form.title,
      amount: validation.amount,
      currency: validation.currency,
      paidBy: form.paidByUserId,
      createdBy: user.id,
    });

    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error);
      return;
    }

    setModalVisible(false);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setListActionError(null);
    const result = await removeExpense(expenseId);

    if (!result.ok) {
      setListActionError(result.error ?? 'Could not delete this expense.');
      return;
    }

    if (result.cleanupWarning) {
      Alert.alert('Expense deleted', result.cleanupWarning);
    }
  };

  const isLoading = spaceLoading || (loadState === 'loading' && expenses.length === 0);
  const listError = spaceError ?? errorMessage;

  if (!spaceId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Trip not found.</Text>
          <PeakButton title="Go back" onPress={handleBack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={PeakColors.textPrimary} />
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Expenses</Text>
          {space?.name ? (
            <Text style={styles.topBarSubtitle} numberOfLines={1}>
              {space.emoji} {space.name}
            </Text>
          ) : null}
        </View>
        <View style={styles.topBarSpacer} />
      </View>

      {listError && expenses.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={PeakColors.textMuted} />
          <Text style={styles.errorTitle}>Could not load expenses</Text>
          <Text style={styles.errorText}>{listError}</Text>
          <PeakButton
            title="Try again"
            onPress={() => {
              void loadSpace();
              void refresh();
              void refreshTripBalances();
            }}
            style={styles.retry}
          />
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PeakColors.primary} />
        </View>
      ) : expenses.length === 0 ? (
        <ExpensesEmptyState />
      ) : (
        <GestureHandlerRootView style={styles.listRoot}>
          <FlatList
            data={expenses}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loadState === 'loading' && expenses.length > 0}
                onRefresh={() => {
                  void refresh();
                  void refreshTripBalances();
                }}
                tintColor={PeakColors.primary}
              />
            }
            ListHeaderComponent={
              <>
                <ExpenseSummarySection summary={expenseSummary} />
                <TripBalancesSection
                  summary={tripBalanceSummary}
                  membersById={membersById}
                  loading={tripBalancesLoadState === 'loading'}
                  errorMessage={tripBalancesError}
                />
                {listError || listActionError ? (
                  <View style={styles.inlineError}>
                    <Text style={styles.errorText}>{listActionError ?? listError}</Text>
                    {listError ? (
                      <PeakButton title="Retry" variant="outline" onPress={refresh} />
                    ) : null}
                  </View>
                ) : null}
              </>
            }
            renderItem={({ item }) => {
              const manageable = canManageExpense(item, user?.id);

              return (
                <SwipeableExpenseListItem
                  expense={item}
                  membersById={membersById}
                  canManage={manageable}
                  onOpen={() => router.push(expenseOpenRoute(spaceId, item))}
                  onEdit={() => router.push(expenseEditRoute(spaceId, item))}
                  onDelete={() => void handleDeleteExpense(item.id)}
                  onSwipeableOpen={(ref) => {
                    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
                      openSwipeableRef.current.close();
                    }
                    openSwipeableRef.current = ref;
                  }}
                />
              );
            }}
          />
        </GestureHandlerRootView>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        style={styles.fab}
        onPress={openAddFlow}>
        <Ionicons name="add" size={28} color={PeakColors.textInverse} />
      </Pressable>

      <AddExpenseChooserModal
        visible={chooserVisible}
        onClose={() => setChooserVisible(false)}
        onScanReceipt={() => openScan('camera')}
        onChoosePhoto={() => openScan('library')}
        onEnterManually={openManualModal}
      />

      <AddExpenseModal
        visible={modalVisible}
        saving={saving}
        saveError={saveError}
        form={form}
        members={members}
        membersLoading={membersLoadState === 'loading' && members.length === 0}
        membersError={membersError}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onClose={closeAddModal}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarTitle: {
    ...Typography.h3,
  },
  topBarSubtitle: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    marginTop: 2,
  },
  topBarSpacer: {
    width: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  listRoot: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.pill,
    backgroundColor: PeakColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PeakColors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  inlineError: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.errorLight,
    gap: Spacing.sm,
  },
  errorTitle: {
    ...Typography.h3,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.bodySmall,
    textAlign: 'center',
    color: PeakColors.textSecondary,
  },
  retry: {
    marginTop: Spacing.lg,
  },
});
