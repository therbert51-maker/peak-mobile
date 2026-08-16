import type { ManualExpense } from '@/lib/expenses';
import { simplifySettlements, toCents, type SettlementTransfer } from '@/lib/trip-settlement';

type TripMemberRef = {
  userId: string;
};

const EXCLUDED_RECEIPT_STATUSES = new Set(['failed', 'uploaded', 'processing']);

function isFinalizableExpense(expense: ManualExpense): boolean {
  if (EXCLUDED_RECEIPT_STATUSES.has(expense.receiptStatus ?? '')) {
    return false;
  }
  if (expense.amount <= 0) {
    return false;
  }
  if (!expense.paidBy) {
    return false;
  }
  return true;
}

export type ExpenseParticipantShare = {
  expenseId: string;
  userId: string;
  totalOwed: number;
};

export type CompletedTripSettlement = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  createdBy: string;
  createdAt: string;
  settledAt: string;
};

export type MemberCurrencyBalance = {
  userId: string;
  paid: number;
  share: number;
  net: number;
};

export type CurrencyTripBalance = {
  currency: string;
  members: MemberCurrencyBalance[];
  transfers: SettlementTransfer[];
};

export type TripBalanceSummary = {
  currencies: CurrencyTripBalance[];
  finalizedExpenseCount: number;
  completedSettlements: CompletedTripSettlement[];
};

function addCents(map: Map<string, number>, userId: string, cents: number) {
  map.set(userId, (map.get(userId) ?? 0) + cents);
}

function finalizedExpenseIds(
  expenses: ManualExpense[],
  participants: ExpenseParticipantShare[],
): Set<string> {
  const idsWithParticipants = new Set<string>();
  for (const participant of participants) {
    idsWithParticipants.add(participant.expenseId);
  }

  const finalized = new Set<string>();
  for (const expense of expenses) {
    if (!isFinalizableExpense(expense)) continue;
    if (idsWithParticipants.has(expense.id)) {
      finalized.add(expense.id);
    }
  }
  return finalized;
}

export function computeTripBalances(input: {
  expenses: ManualExpense[];
  participants: ExpenseParticipantShare[];
  members: TripMemberRef[];
  settlements?: CompletedTripSettlement[];
}): TripBalanceSummary {
  const completedSettlements = input.settlements ?? [];
  const finalizedIds = finalizedExpenseIds(input.expenses, input.participants);
  const expenseById = new Map(input.expenses.map((expense) => [expense.id, expense]));

  const paidCentsByCurrency = new Map<string, Map<string, number>>();
  const shareCentsByCurrency = new Map<string, Map<string, number>>();

  for (const expenseId of finalizedIds) {
    const expense = expenseById.get(expenseId);
    if (!expense?.paidBy) continue;

    const currency = expense.currency.toUpperCase();
    const paidMap = paidCentsByCurrency.get(currency) ?? new Map<string, number>();
    addCents(paidMap, expense.paidBy, toCents(expense.amount));
    paidCentsByCurrency.set(currency, paidMap);
  }

  for (const participant of input.participants) {
    if (!finalizedIds.has(participant.expenseId)) continue;

    const expense = expenseById.get(participant.expenseId);
    if (!expense) continue;

    const currency = expense.currency.toUpperCase();
    const shareMap = shareCentsByCurrency.get(currency) ?? new Map<string, number>();
    addCents(shareMap, participant.userId, toCents(participant.totalOwed));
    shareCentsByCurrency.set(currency, shareMap);
  }

  const memberOrder = new Map(input.members.map((member, index) => [member.userId, index]));
  const allUserIds = new Set<string>(input.members.map((member) => member.userId));

  for (const map of paidCentsByCurrency.values()) {
    for (const userId of map.keys()) allUserIds.add(userId);
  }
  for (const map of shareCentsByCurrency.values()) {
    for (const userId of map.keys()) allUserIds.add(userId);
  }
  for (const settlement of completedSettlements) {
    allUserIds.add(settlement.fromUserId);
    allUserIds.add(settlement.toUserId);
  }

  const currencies = Array.from(
    new Set([
      ...paidCentsByCurrency.keys(),
      ...shareCentsByCurrency.keys(),
      ...completedSettlements.map((settlement) => settlement.currency.toUpperCase()),
    ]),
  ).sort();

  const currencyBalances: CurrencyTripBalance[] = currencies.map((currency) => {
    const paidMap = paidCentsByCurrency.get(currency) ?? new Map<string, number>();
    const shareMap = shareCentsByCurrency.get(currency) ?? new Map<string, number>();
    const netCentsByUser = new Map<string, number>();

    for (const userId of allUserIds) {
      const paidCents = paidMap.get(userId) ?? 0;
      const shareCents = shareMap.get(userId) ?? 0;
      netCentsByUser.set(userId, paidCents - shareCents);
    }

    for (const settlement of completedSettlements) {
      if (settlement.currency.toUpperCase() !== currency) continue;
      const amountCents = toCents(settlement.amount);
      addCents(netCentsByUser, settlement.fromUserId, amountCents);
      addCents(netCentsByUser, settlement.toUserId, -amountCents);
    }

    const members = Array.from(allUserIds)
      .map((userId) => {
        const paidCents = paidMap.get(userId) ?? 0;
        const shareCents = shareMap.get(userId) ?? 0;
        return {
          userId,
          paid: paidCents / 100,
          share: shareCents / 100,
          net: (netCentsByUser.get(userId) ?? 0) / 100,
        };
      })
      .filter((entry) => entry.paid !== 0 || entry.share !== 0 || entry.net !== 0)
      .sort((a, b) => {
        const orderA = memberOrder.get(a.userId) ?? Number.MAX_SAFE_INTEGER;
        const orderB = memberOrder.get(b.userId) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.userId.localeCompare(b.userId);
      });

    return {
      currency,
      members,
      transfers: simplifySettlements(netCentsByUser),
    };
  });

  return {
    currencies: currencyBalances,
    finalizedExpenseCount: finalizedIds.size,
    completedSettlements,
  };
}
