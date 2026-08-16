import type { ExpenseParticipant } from '@/types/database';

export type ExpenseSettlementDebtor = {
  userId: string;
  amount: number;
};

export type ExpenseSettlementSummary = {
  payerId: string;
  paidAmount: number;
  payerShare: number;
  amountOwedToPayer: number;
  debtors: ExpenseSettlementDebtor[];
};

type ParticipantShare = Pick<ExpenseParticipant, 'user_id' | 'total_owed'>;

function toCents(value: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0
    ? Math.round((numeric + Number.EPSILON) * 100)
    : 0;
}

export function deriveExpenseSettlement(input: {
  payerId: string | null;
  expenseTotal: number;
  participants: ParticipantShare[];
}): ExpenseSettlementSummary | null {
  if (!input.payerId || input.participants.length === 0) {
    return null;
  }

  const payerShareCents = input.participants
    .filter((participant) => participant.user_id === input.payerId)
    .reduce((sum, participant) => sum + toCents(participant.total_owed), 0);

  const debtors = input.participants
    .filter((participant) => participant.user_id !== input.payerId)
    .map((participant) => ({
      userId: participant.user_id,
      amount: toCents(participant.total_owed) / 100,
    }))
    .filter((debtor) => debtor.amount > 0);

  const amountOwedToPayerCents = debtors.reduce(
    (sum, debtor) => sum + toCents(debtor.amount),
    0,
  );

  return {
    payerId: input.payerId,
    paidAmount: toCents(input.expenseTotal) / 100,
    payerShare: payerShareCents / 100,
    amountOwedToPayer: amountOwedToPayerCents / 100,
    debtors,
  };
}
