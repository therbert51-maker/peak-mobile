import { computeExpenseSummary, type CurrencyAmount } from '@/lib/expense-summary';
import type { ManualExpense } from '@/lib/expenses';
import { formatSupabaseError, warnSpacesWithNullOwner } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';
import type { Expense, Space, SpaceMember } from '@/types/database';

export type SplitSpaceSummary = {
  space: Space;
  totals: CurrencyAmount[];
  expenseCount: number;
  memberCount: number;
};

type HubExpenseRow = Pick<
  Expense,
  | 'id'
  | 'space_id'
  | 'expense_title'
  | 'total'
  | 'original_currency'
  | 'paid_by'
  | 'created_by'
  | 'created_at'
  | 'receipt_status'
>;

type HubMemberRow = Pick<SpaceMember, 'space_id' | 'user_id'>;

function toManualExpense(row: HubExpenseRow): ManualExpense {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.expense_title,
    amount: Number(row.total),
    currency: row.original_currency,
    paidBy: row.paid_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    receiptStatus: row.receipt_status,
  };
}

export async function fetchSplitSpaceSummaries(): Promise<{
  data: SplitSpaceSummary[] | null;
  error: string | null;
}> {
  const { data: spaces, error: spacesError } = await supabase
    .from('spaces')
    .select('*')
    .order('created_at', { ascending: false });

  if (spacesError) {
    return { data: null, error: formatSupabaseError(spacesError) };
  }

  if (!spaces?.length) {
    return { data: [], error: null };
  }

  warnSpacesWithNullOwner(spaces);

  const spaceIds = spaces.map((space) => space.id);
  const [expensesResult, membersResult] = await Promise.all([
    supabase
      .from('expenses')
      .select(
        'id, space_id, expense_title, total, original_currency, paid_by, created_by, created_at, receipt_status',
      )
      .in('space_id', spaceIds),
    supabase.from('space_members').select('space_id, user_id').in('space_id', spaceIds),
  ]);

  if (expensesResult.error) {
    return { data: null, error: formatSupabaseError(expensesResult.error) };
  }

  if (membersResult.error) {
    return { data: null, error: formatSupabaseError(membersResult.error) };
  }

  const expensesBySpace = new Map<string, ManualExpense[]>();
  for (const row of (expensesResult.data ?? []) as HubExpenseRow[]) {
    const expenses = expensesBySpace.get(row.space_id) ?? [];
    expenses.push(toManualExpense(row));
    expensesBySpace.set(row.space_id, expenses);
  }

  const memberIdsBySpace = new Map<string, Set<string>>();
  for (const row of (membersResult.data ?? []) as HubMemberRow[]) {
    const memberIds = memberIdsBySpace.get(row.space_id) ?? new Set<string>();
    memberIds.add(row.user_id);
    memberIdsBySpace.set(row.space_id, memberIds);
  }

  return {
    data: spaces.map((space) => {
      const expenses = expensesBySpace.get(space.id) ?? [];
      const summary = computeExpenseSummary(expenses, []);
      const memberIds = memberIdsBySpace.get(space.id) ?? new Set<string>();

      if (space.owner_id) {
        memberIds.add(space.owner_id);
      }

      return {
        space,
        totals: summary.tripTotals,
        expenseCount: summary.includedExpenseCount,
        memberCount: memberIds.size,
      };
    }),
    error: null,
  };
}
