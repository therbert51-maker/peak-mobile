import { computeTripBalances, type TripBalanceSummary } from '@/lib/trip-balances';
import { fetchManualExpensesForSpace } from '@/lib/expenses';
import { formatSupabaseError } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';
import type { TripMember } from '@/lib/trip-members';

type ParticipantRow = {
  expense_id: string;
  user_id: string;
  total_owed: number;
};

export async function fetchTripBalanceSummary(
  spaceId: string,
  members: TripMember[],
): Promise<{ data: TripBalanceSummary | null; error: string | null }> {
  const expensesResult = await fetchManualExpensesForSpace(spaceId);
  if (expensesResult.error) {
    return { data: null, error: expensesResult.error };
  }

  const expenses = expensesResult.data ?? [];
  const expenseIds = expenses.map((expense) => expense.id);

  if (expenseIds.length === 0) {
    return {
      data: computeTripBalances({ expenses: [], participants: [], members }),
      error: null,
    };
  }

  const { data, error } = await supabase
    .from('expense_participants')
    .select('expense_id, user_id, total_owed')
    .in('expense_id', expenseIds);

  if (error) {
    return { data: null, error: formatSupabaseError(error) };
  }

  const participants = ((data ?? []) as ParticipantRow[]).map((row) => ({
    expenseId: row.expense_id,
    userId: row.user_id,
    totalOwed: Number(row.total_owed),
  }));

  return {
    data: computeTripBalances({ expenses, participants, members }),
    error: null,
  };
}
