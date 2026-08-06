import { formatSupabaseError } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';
import type { Expense, ExpenseInsert } from '@/types/database';

/** Simple manual expense shape used in the UI (maps to public.expenses). */
export type ManualExpense = {
  id: string;
  spaceId: string;
  title: string;
  amount: number;
  currency: string;
  paidBy: string | null;
  createdBy: string;
  createdAt: string;
};

export type CreateManualExpenseInput = {
  spaceId: string;
  title: string;
  amount: number;
  currency: string;
  paidBy: string | null;
  createdBy: string;
};

export const DEFAULT_EXPENSE_CURRENCY = 'USD';

export const EXPENSE_CURRENCY_OPTIONS = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'MXN',
  'JPY',
  'CHF',
  'NZD',
  'SGD',
] as const;

export type ExpenseCurrencyCode = (typeof EXPENSE_CURRENCY_OPTIONS)[number];

export function expenseRowToManual(row: Expense): ManualExpense {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.expense_title,
    amount: Number(row.total),
    currency: row.original_currency,
    paidBy: row.paid_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function formatExpenseAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function parseExpenseAmountInput(raw: string): number | null {
  const normalized = raw.replace(/,/g, '').trim();
  if (!normalized) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function validateManualExpenseInput(input: {
  title: string;
  amountRaw: string;
  currency: string;
  paidBy: string | null;
}): { ok: true; amount: number; currency: string } | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: 'Enter an expense title.' };
  }

  const amount = parseExpenseAmountInput(input.amountRaw);
  if (amount === null || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }

  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: 'Choose a valid 3-letter currency code.' };
  }

  if (!input.paidBy) {
    return { ok: false, error: 'Choose who paid for this expense.' };
  }

  return { ok: true, amount, currency };
}

export function buildManualExpenseInsert(input: CreateManualExpenseInput): ExpenseInsert {
  return {
    space_id: input.spaceId,
    created_by: input.createdBy,
    paid_by: input.paidBy,
    expense_title: input.title.trim(),
    total: input.amount,
    original_currency: input.currency.toUpperCase(),
    display_currency: input.currency.toUpperCase(),
    receipt_status: 'manual',
    tax: 0,
    tip: 0,
    fees: 0,
    discount: 0,
  };
}

export async function fetchManualExpensesForSpace(spaceId: string): Promise<{
  data: ManualExpense[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'id, space_id, expense_title, total, original_currency, paid_by, created_by, created_at',
    )
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: formatSupabaseError(error) };
  }

  return {
    data: (data ?? []).map((row) => expenseRowToManual(row as Expense)),
    error: null,
  };
}

export async function createManualExpense(
  input: CreateManualExpenseInput,
): Promise<{ data: ManualExpense | null; error: string | null }> {
  const payload = buildManualExpenseInsert(input);

  const { data, error } = await supabase.from('expenses').insert(payload).select().single();

  if (error || !data) {
    return {
      data: null,
      error: error ? formatSupabaseError(error) : 'Could not save this expense.',
    };
  }

  return { data: expenseRowToManual(data), error: null };
}
