import type {
  CalculatedItemAssignment,
  CalculatedParticipantShare,
  ExpenseItemSelections,
} from '@/lib/expense-split';
import { formatSupabaseError } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';
import type {
  ExpenseItemAssignment,
  ExpenseParticipant,
  Json,
} from '@/types/database';

export async function fetchExpenseItemAssignments(itemIds: string[]): Promise<{
  data: ExpenseItemAssignment[] | null;
  error: string | null;
}> {
  if (itemIds.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from('expense_item_assignments')
    .select('*')
    .in('expense_item_id', itemIds);

  if (error) {
    return { data: null, error: formatSupabaseError(error) };
  }

  return { data: data ?? [], error: null };
}

export async function fetchExpenseParticipants(expenseId: string): Promise<{
  data: ExpenseParticipant[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('expense_participants')
    .select('user_id, tax_share, tip_share, fee_share, discount_share, total_owed')
    .eq('expense_id', expenseId);

  if (error) {
    if (__DEV__) {
      console.warn('[expense-split] fetchExpenseParticipants failed', {
        expenseId,
        code: error.code,
        message: error.message,
      });
    }
    return { data: null, error: formatSupabaseError(error) };
  }

  const rows = (data ?? []) as ExpenseParticipant[];

  if (__DEV__) {
    console.info('[expense-split] fetchExpenseParticipants', {
      expenseId,
      rowCount: rows.length,
    });
  }

  return { data: rows, error: null };
}

export function assignmentRowsToSelections(
  rows: Pick<ExpenseItemAssignment, 'expense_item_id' | 'user_id'>[],
): ExpenseItemSelections {
  const selections: ExpenseItemSelections = {};

  for (const row of rows) {
    const userIds = selections[row.expense_item_id] ?? [];
    if (!userIds.includes(row.user_id)) {
      userIds.push(row.user_id);
    }
    selections[row.expense_item_id] = userIds;
  }

  return selections;
}

export async function saveExpenseSplit(input: {
  expenseId: string;
  assignments: CalculatedItemAssignment[];
  participants: CalculatedParticipantShare[];
}): Promise<{ ok: boolean; error: string | null }> {
  const assignments = input.assignments.map((assignment) => ({
    expense_item_id: assignment.expenseItemId,
    user_id: assignment.userId,
    assigned_amount: assignment.assignedAmount,
  })) as Json;
  const participants = input.participants.map((participant) => ({
    user_id: participant.userId,
    tax_share: participant.taxShare,
    tip_share: participant.tipShare,
    fee_share: participant.feeShare,
    discount_share: participant.discountShare,
    adjustment: participant.adjustment,
    total_owed: participant.totalOwed,
  })) as Json;

  if (__DEV__) {
    console.info('[expense-split] Calling save_expense_split', {
      expenseId: input.expenseId,
      assignmentCount: input.assignments.length,
      participantCount: input.participants.length,
    });
  }

  const { error } = await supabase.rpc('save_expense_split', {
    p_expense_id: input.expenseId,
    p_assignments: assignments,
    p_participants: participants,
  });

  if (error) {
    if (__DEV__) {
      console.warn('[expense-split] save_expense_split failed', {
        expenseId: input.expenseId,
        code: error.code,
        message: error.message,
      });
    }
    return { ok: false, error: formatSupabaseError(error) };
  }

  if (__DEV__) {
    console.info('[expense-split] save_expense_split succeeded', {
      expenseId: input.expenseId,
    });
  }

  return { ok: true, error: null };
}
