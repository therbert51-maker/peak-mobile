import type { ManualExpense } from '@/lib/expenses';
import { tripMemberDisplayName, type TripMember } from '@/lib/trip-members';

export type CurrencyAmount = {
  currency: string;
  amount: number;
};

export type MemberExpenseSummary = {
  userId: string;
  member: TripMember | null;
  totalsByCurrency: CurrencyAmount[];
};

export type ExpenseSummary = {
  tripTotals: CurrencyAmount[];
  memberTotals: MemberExpenseSummary[];
  includedExpenseCount: number;
};

const EXCLUDED_STATUSES = new Set(['failed', 'uploaded', 'processing']);

export function isExpenseIncludedInSummary(expense: ManualExpense): boolean {
  if (EXCLUDED_STATUSES.has(expense.receiptStatus ?? '')) {
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

function addToCurrencyMap(map: Map<string, number>, currency: string, amount: number) {
  const code = currency.toUpperCase();
  map.set(code, (map.get(code) ?? 0) + amount);
}

function currencyMapToSortedList(map: Map<string, number>): CurrencyAmount[] {
  return Array.from(map.entries())
    .map(([currency, amount]) => ({ currency, amount: roundMoney(amount) }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeExpenseSummary(
  expenses: ManualExpense[],
  members: TripMember[],
): ExpenseSummary {
  const included = expenses.filter(isExpenseIncludedInSummary);
  const tripMap = new Map<string, number>();
  const memberMaps = new Map<string, Map<string, number>>();

  for (const expense of included) {
    const payerId = expense.paidBy!;
    addToCurrencyMap(tripMap, expense.currency, expense.amount);

    const memberMap = memberMaps.get(payerId) ?? new Map<string, number>();
    addToCurrencyMap(memberMap, expense.currency, expense.amount);
    memberMaps.set(payerId, memberMap);
  }

  const membersById = new Map(members.map((member) => [member.userId, member]));
  const memberOrder = new Map(members.map((member, index) => [member.userId, index]));

  const memberTotals = Array.from(memberMaps.entries())
    .map(([userId, currencyMap]) => ({
      userId,
      member: membersById.get(userId) ?? null,
      totalsByCurrency: currencyMapToSortedList(currencyMap),
    }))
    .sort((a, b) => {
      const orderA = memberOrder.get(a.userId) ?? Number.MAX_SAFE_INTEGER;
      const orderB = memberOrder.get(b.userId) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const nameA = a.member ? tripMemberDisplayName(a.member) : a.userId;
      const nameB = b.member ? tripMemberDisplayName(b.member) : b.userId;
      return nameA.localeCompare(nameB);
    });

  return {
    tripTotals: currencyMapToSortedList(tripMap),
    memberTotals,
    includedExpenseCount: included.length,
  };
}
