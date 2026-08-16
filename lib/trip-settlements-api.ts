import { formatSupabaseError } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';
import type { CompletedTripSettlement } from '@/lib/trip-balances';
import { fromCents, toCents } from '@/lib/trip-settlement';
import type { Settlement } from '@/types/database';

const SETTLEMENT_COLUMNS =
  'id, space_id, from_user_id, to_user_id, amount, currency, status, created_by, created_at, settled_at';

function rowToCompletedSettlement(
  row: Pick<
    Settlement,
    | 'id'
    | 'from_user_id'
    | 'to_user_id'
    | 'amount'
    | 'currency'
    | 'created_by'
    | 'created_at'
    | 'settled_at'
  >,
): CompletedTripSettlement | null {
  if (!row.settled_at) return null;
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    amount: fromCents(toCents(Number(row.amount))),
    currency: row.currency.toUpperCase(),
    createdBy: row.created_by,
    createdAt: row.created_at,
    settledAt: row.settled_at,
  };
}

export async function fetchCompletedSettlements(
  spaceId: string,
): Promise<{ data: CompletedTripSettlement[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('settlements')
    .select(SETTLEMENT_COLUMNS)
    .eq('space_id', spaceId)
    .eq('status', 'paid')
    .order('settled_at', { ascending: false });

  if (error) {
    return { data: null, error: formatSupabaseError(error) };
  }

  const settlements = (data ?? [])
    .map((row) => rowToCompletedSettlement(row as Settlement))
    .filter((row): row is CompletedTripSettlement => row !== null);

  return { data: settlements, error: null };
}

export async function markSettlementPaid(input: {
  spaceId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  createdBy: string;
}): Promise<{ data: CompletedTripSettlement | null; error: string | null }> {
  const amountCents = toCents(input.amount);
  const currency = input.currency.trim().toUpperCase();

  if (amountCents <= 0) {
    return { data: null, error: 'Settlement amount must be greater than zero.' };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { data: null, error: 'Settlement currency must be a 3-letter code.' };
  }
  if (input.fromUserId === input.toUserId) {
    return { data: null, error: 'Payer and recipient must be different members.' };
  }

  const settledAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('settlements')
    .insert({
      space_id: input.spaceId,
      from_user_id: input.fromUserId,
      to_user_id: input.toUserId,
      amount: fromCents(amountCents),
      currency,
      status: 'paid',
      created_by: input.createdBy,
      settled_at: settledAt,
    })
    .select(SETTLEMENT_COLUMNS)
    .single();

  if (error || !data) {
    return {
      data: null,
      error: error ? formatSupabaseError(error) : 'Could not record this payment.',
    };
  }

  return {
    data: rowToCompletedSettlement(data as Settlement),
    error: null,
  };
}
