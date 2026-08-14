import { supabase } from '@/lib/supabase';
import type { ExpenseItemInsert } from '@/types/database';

export type ReviewSaveInput = {
  expenseId: string;
  merchantName: string | null;
  expenseTitle: string;
  expenseDate: string | null;
  originalCurrency: string;
  displayCurrency: string;
  subtotal: number | null;
  tax: number;
  tip: number;
  fees: number;
  discount: number;
  total: number;
  items: {
    id?: string;
    name: string;
    quantity: number;
    unit_price: number | null;
    line_total: number;
    sort_order: number;
    category: string | null;
    source_text: string | null;
    confidence: number | null;
  }[];
};

export async function saveReceiptReview(input: ReviewSaveInput): Promise<{ ok: boolean; error: string | null }> {
  const { data: updatedExpense, error: expenseError } = await supabase
    .from('expenses')
    .update({
      merchant_name: input.merchantName,
      expense_title: input.expenseTitle.trim(),
      expense_date: input.expenseDate,
      original_currency: input.originalCurrency.toUpperCase(),
      display_currency: input.displayCurrency.toUpperCase(),
      subtotal: input.subtotal,
      tax: input.tax,
      tip: input.tip,
      fees: input.fees,
      discount: input.discount,
      total: input.total,
      receipt_status: 'ready',
      processing_error: null,
    })
    .eq('id', input.expenseId)
    .select('id')
    .maybeSingle();

  if (expenseError || !updatedExpense) {
    return {
      ok: false,
      error: expenseError?.message ?? 'You do not have permission to edit this expense.',
    };
  }

  const { error: deleteError } = await supabase
    .from('expense_items')
    .delete()
    .eq('expense_id', input.expenseId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  if (input.items.length > 0) {
    const rows: ExpenseItemInsert[] = input.items.map((item) => ({
      expense_id: input.expenseId,
      name: item.name.trim(),
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      sort_order: item.sort_order,
      category: item.category,
      source_text: item.source_text,
      confidence: item.confidence,
    }));

    const { error: insertError } = await supabase.from('expense_items').insert(rows);
    if (insertError) {
      return { ok: false, error: insertError.message };
    }
  }

  return { ok: true, error: null };
}
