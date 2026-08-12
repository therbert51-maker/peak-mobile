import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AddExpenseModal,
  emptyAddExpenseForm,
  type AddExpenseFormState,
} from '@/components/expenses/AddExpenseModal';
import { AddExpenseChooserModal } from '@/components/expenses/AddExpenseChooserModal';
import { ExpenseListItem } from '@/components/expenses/ExpenseListItem';
import { ExpensesEmptyState } from '@/components/expenses/ExpensesEmptyState';
import { PeakButton } from '@/components/ui/PeakButton';
import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useSpaceExpenses } from '@/hooks/use-space-expenses';
import { useTripMembers } from '@/hooks/use-trip-members';
import { validateManualExpenseInput } from '@/lib/expenses';
import { supabase } from '@/lib/supabase';
import type { Space } from '@/types/database';

export default function SpaceExpensesScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = Array.isArray(id) ? id[0] : id;

  const [space, setSpace] = useState<Space | null>(null);
  const [spaceLoading, setSpaceLoading] = useState(true);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  const { expenses, loadState, errorMessage, refresh, addExpense } = useSpaceExpenses(spaceId);
  const {
    members,
    loadState: membersLoadState,
    errorMessage: membersError,
    refresh: refreshMembers,
  } = useTripMembers(spaceId, space?.owner_id);

  const [chooserVisible, setChooserVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<AddExpenseFormState>(() => emptyAddExpenseForm(user?.id ?? null));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const membersById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

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

  const isLoading = spaceLoading || (loadState === 'loading' && expenses.length === 0);
  const listError = spaceError ?? errorMessage;

  if (!spaceId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Trip not found.</Text>
          <PeakButton title="Go back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
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
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={loadState === 'loading' && expenses.length > 0}
              onRefresh={refresh}
              tintColor={PeakColors.primary}
            />
          }
          ListHeaderComponent={
            listError ? (
              <View style={styles.inlineError}>
                <Text style={styles.errorText}>{listError}</Text>
                <PeakButton title="Retry" variant="outline" onPress={refresh} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ExpenseListItem
              expense={item}
              membersById={membersById}
              onPress={() => {
                const status = item.receiptStatus;
                if (status === 'processing' || status === 'uploaded') {
                  router.push({
                    pathname: '/spaces/[id]/expenses/processing',
                    params: { id: spaceId, expenseId: item.id },
                  });
                  return;
                }
                if (status === 'needs_review' || status === 'failed') {
                  router.push({
                    pathname: '/spaces/[id]/expenses/[expenseId]/review',
                    params: { id: spaceId, expenseId: item.id },
                  });
                  return;
                }
                router.push({
                  pathname: '/spaces/[id]/expenses/[expenseId]',
                  params: { id: spaceId, expenseId: item.id },
                });
              }}
            />
          )}
        />
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
