import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { DEFAULT_EXPENSE_CURRENCY, EXPENSE_CURRENCY_OPTIONS, parseExpenseAmountInput } from '@/lib/expenses';
import { computeReceiptReconciliation } from '@/lib/receipt/reconcile';
import {
  fetchExpenseForReview,
  fetchExpenseItems,
  fetchReceiptProcessingJob,
  signedReceiptImageUrl,
} from '@/lib/receipt/receipt-api';
import type { ParsedReceiptPayload } from '@/lib/receipt/types';
import { saveReceiptReview } from '@/lib/receipt/save-review';
import type { ReceiptReviewItem } from '@/lib/receipt/types';
import type { Expense, ExpenseItem } from '@/types/database';

function itemFromRow(row: ExpenseItem): ReceiptReviewItem {
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity),
    unit_price: row.unit_price === null ? null : Number(row.unit_price),
    line_total: Number(row.line_total),
    category: row.category,
    source_text: row.source_text,
    confidence: row.confidence === null ? 1 : Number(row.confidence),
    sort_order: row.sort_order,
  };
}

function newItem(sortOrder: number): ReceiptReviewItem {
  return {
    id: `new-${Date.now()}-${sortOrder}`,
    name: '',
    quantity: 1,
    unit_price: null,
    line_total: 0,
    category: null,
    source_text: null,
    confidence: 1,
    sort_order: sortOrder,
  };
}

export default function ReceiptReviewScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const spaceId = Array.isArray(id) ? id[0] : id;
  const expenseIdValue = Array.isArray(expenseId) ? expenseId[0] : expenseId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [items, setItems] = useState<ReceiptReviewItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [ackMismatch, setAckMismatch] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!expenseIdValue) return;
    setLoading(true);
    setErrorMessage(null);

    const [expenseResult, itemsResult, jobResult] = await Promise.all([
      fetchExpenseForReview(expenseIdValue),
      fetchExpenseItems(expenseIdValue),
      fetchReceiptProcessingJob(expenseIdValue),
    ]);

    if (expenseResult.error || !expenseResult.data) {
      setErrorMessage(expenseResult.error?.message ?? 'Could not load expense.');
      setLoading(false);
      return;
    }

    setExpense(expenseResult.data);
    setItems((itemsResult.data ?? []).map(itemFromRow));

    const payload = jobResult.data?.extracted_payload as ParsedReceiptPayload | null;
    if (payload?.warnings?.length) {
      setWarnings(payload.warnings);
    }

    if (expenseResult.data.receipt_image_path) {
      const url = await signedReceiptImageUrl(expenseResult.data.receipt_image_path);
      setThumbUrl(url);
    }

    setLoading(false);
  }, [expenseIdValue]);

  useEffect(() => {
    void load();
  }, [load]);

  const reconciliation = useMemo(() => {
    if (!expense) return null;
    return computeReceiptReconciliation({
      items,
      subtotal: expense.subtotal === null ? null : Number(expense.subtotal),
      tax: Number(expense.tax),
      tip: Number(expense.tip),
      fees: Number(expense.fees),
      discount: Number(expense.discount),
      total: Number(expense.total),
    });
  }, [expense, items]);

  const updateExpenseField = <K extends keyof Expense>(key: K, value: Expense[K]) => {
    setExpense((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateItem = (itemId: string, patch: Partial<ReceiptReviewItem>) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((item, sort_order) => ({ ...item, sort_order }));
    });
  };

  const handleSave = async () => {
    if (!expense || !expenseIdValue || !spaceId) return;

    if (!expense.expense_title.trim()) {
      setErrorMessage('Expense title is required.');
      return;
    }

    if (reconciliation && !reconciliation.matches && !ackMismatch) {
      setErrorMessage('Totals do not match — review the breakdown and acknowledge to continue.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const result = await saveReceiptReview({
      expenseId: expenseIdValue,
      merchantName: expense.merchant_name,
      expenseTitle: expense.expense_title,
      expenseDate: expense.expense_date,
      originalCurrency: expense.original_currency,
      displayCurrency: expense.display_currency ?? expense.original_currency,
      subtotal: expense.subtotal === null ? null : Number(expense.subtotal),
      tax: Number(expense.tax),
      tip: Number(expense.tip),
      fees: Number(expense.fees),
      discount: Number(expense.discount),
      total: Number(expense.total),
      items: items
        .filter((item) => item.name.trim())
        .map((item, index) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          sort_order: index,
        })),
    });

    setSaving(false);

    if (!result.ok) {
      setErrorMessage(result.error ?? 'Could not save.');
      return;
    }

    router.replace({
      pathname: '/spaces/[id]/expenses/[expenseId]',
      params: { id: spaceId, expenseId: expenseIdValue },
    });
  };

  if (loading || !expense) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          {errorMessage ? (
            <>
              <Text style={styles.error}>{errorMessage}</Text>
              <PeakButton title="Try again" onPress={load} />
            </>
          ) : (
            <ActivityIndicator size="large" color={PeakColors.primary} />
          )}
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
        <Text style={styles.topTitle}>Review receipt</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.thumb} contentFit="cover" />
        ) : null}

        {warnings.length > 0 ? (
          <View style={styles.warningBox}>
            {warnings.map((warning) => (
              <Text key={warning} style={styles.warningText}>
                • {warning}
              </Text>
            ))}
          </View>
        ) : null}

        <PeakInput
          label="Merchant"
          value={expense.merchant_name ?? ''}
          onChangeText={(merchant_name) => updateExpenseField('merchant_name', merchant_name || null)}
        />
        <PeakInput
          label="Expense title"
          value={expense.expense_title}
          onChangeText={(expense_title) => updateExpenseField('expense_title', expense_title)}
        />
        <PeakInput
          label="Date (YYYY-MM-DD)"
          value={expense.expense_date ?? ''}
          onChangeText={(expense_date) => updateExpenseField('expense_date', expense_date || null)}
        />

        <Text style={styles.fieldLabel}>Original currency</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyRow}>
          {EXPENSE_CURRENCY_OPTIONS.map((code) => (
            <Pressable
              key={code}
              onPress={() => updateExpenseField('original_currency', code)}
              style={[styles.chip, expense.original_currency === code && styles.chipSelected]}>
              <Text style={styles.chipText}>{code}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <PeakInput
          label="Display currency"
          value={expense.display_currency ?? DEFAULT_EXPENSE_CURRENCY}
          onChangeText={(display_currency) => updateExpenseField('display_currency', display_currency.toUpperCase())}
        />

        {(['subtotal', 'tax', 'tip', 'fees', 'discount', 'total'] as const).map((field) => (
          <PeakInput
            key={field}
            label={field.charAt(0).toUpperCase() + field.slice(1)}
            keyboardType="decimal-pad"
            value={expense[field] === null ? '' : String(expense[field])}
            onChangeText={(raw) => {
              if (field === 'subtotal' && !raw.trim()) {
                updateExpenseField('subtotal', null);
                return;
              }
              const parsed = parseExpenseAmountInput(raw);
              updateExpenseField(field, (parsed ?? 0) as Expense[typeof field]);
            }}
          />
        ))}

        {reconciliation ? (
          <View style={[styles.reconcileBox, !reconciliation.matches && styles.reconcileWarn]}>
            <Text style={styles.reconcileTitle}>Total check</Text>
            <Text style={styles.reconcileLine}>Line items sum: {reconciliation.itemsSum.toFixed(2)}</Text>
            <Text style={styles.reconcileLine}>Expected total: {reconciliation.expectedTotal.toFixed(2)}</Text>
            <Text style={styles.reconcileLine}>Receipt total: {reconciliation.reportedTotal.toFixed(2)}</Text>
            {!reconciliation.matches ? (
              <Pressable onPress={() => setAckMismatch((v) => !v)} style={styles.ackRow}>
                <Ionicons
                  name={ackMismatch ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={PeakColors.primary}
                />
                <Text style={styles.ackText}>I reviewed the mismatch and want to save anyway</Text>
              </Pressable>
            ) : (
              <Text style={styles.reconcileOk}>Totals reconcile within ¢2</Text>
            )}
          </View>
        ) : null}

        <View style={styles.itemsHeader}>
          <Text style={styles.itemsTitle}>Items</Text>
          <PeakButton
            title="Add item"
            variant="secondary"
            onPress={() => setItems((prev) => [...prev, newItem(prev.length)])}
          />
        </View>

        {items.map((item, index) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemTop}>
              <Text style={styles.itemIndex}>#{index + 1}</Text>
              {item.confidence < 0.75 ? (
                <Text style={styles.lowConfidence}>Low confidence ({Math.round(item.confidence * 100)}%)</Text>
              ) : null}
              <View style={styles.itemActions}>
                <Pressable onPress={() => moveItem(index, -1)} hitSlop={8}>
                  <Ionicons name="arrow-up" size={18} color={PeakColors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => moveItem(index, 1)} hitSlop={8}>
                  <Ionicons name="arrow-down" size={18} color={PeakColors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => setItems((prev) => prev.filter((row) => row.id !== item.id))} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={PeakColors.error} />
                </Pressable>
              </View>
            </View>
            <PeakInput label="Name" value={item.name} onChangeText={(name) => updateItem(item.id, { name })} />
            <PeakInput
              label="Quantity"
              keyboardType="decimal-pad"
              value={String(item.quantity)}
              onChangeText={(raw) => {
                const parsed = parseExpenseAmountInput(raw);
                if (parsed && parsed > 0) updateItem(item.id, { quantity: parsed });
              }}
            />
            <PeakInput
              label="Unit price"
              keyboardType="decimal-pad"
              value={item.unit_price === null ? '' : String(item.unit_price)}
              onChangeText={(raw) => {
                const parsed = parseExpenseAmountInput(raw);
                updateItem(item.id, { unit_price: parsed });
              }}
            />
            <PeakInput
              label="Line total"
              keyboardType="decimal-pad"
              value={String(item.line_total)}
              onChangeText={(raw) => {
                const parsed = parseExpenseAmountInput(raw);
                updateItem(item.id, { line_total: parsed ?? 0 });
              }}
            />
          </View>
        ))}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PeakButton fullWidth loading={saving} title="Mark reviewed & save" onPress={handleSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PeakColors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  topTitle: { ...Typography.h3, flex: 1, textAlign: 'center' },
  spacer: { width: 24 },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 120 },
  thumb: { width: '100%', height: 160, borderRadius: BorderRadius.medium },
  warningBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.errorLight,
    gap: 4,
  },
  warningText: { ...Typography.caption, color: PeakColors.error },
  fieldLabel: { ...Typography.label },
  currencyRow: { gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: PeakColors.border,
  },
  chipSelected: { borderColor: PeakColors.primary, backgroundColor: PeakColors.primaryLight },
  chipText: { ...Typography.label },
  reconcileBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: PeakColors.border,
    gap: 4,
  },
  reconcileWarn: { borderColor: PeakColors.error, backgroundColor: PeakColors.errorLight },
  reconcileTitle: { ...Typography.label },
  reconcileLine: { ...Typography.bodySmall },
  reconcileOk: { ...Typography.caption, color: PeakColors.primaryDark },
  ackRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  ackText: { ...Typography.caption, flex: 1 },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemsTitle: { ...Typography.h3 },
  itemCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
    gap: Spacing.sm,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemIndex: { ...Typography.caption, fontWeight: '800' },
  lowConfidence: { ...Typography.caption, color: PeakColors.error, flex: 1 },
  itemActions: { flexDirection: 'row', gap: Spacing.sm, marginLeft: 'auto' },
  error: { ...Typography.bodySmall, color: PeakColors.error, textAlign: 'center' },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PeakColors.border,
    backgroundColor: PeakColors.background,
  },
});
