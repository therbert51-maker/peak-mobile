import type { Expense, ExpenseItem } from '@/types/database';

export type ExpenseItemSelections = Record<string, string[]>;

export type CalculatedItemAssignment = {
  expenseItemId: string;
  userId: string;
  assignedAmount: number;
};

export type CalculatedParticipantShare = {
  userId: string;
  itemSubtotal: number;
  taxShare: number;
  tipShare: number;
  feeShare: number;
  discountShare: number;
  adjustment: number;
  totalOwed: number;
};

export type ExpenseSplitCalculation = {
  receiptTotal: number;
  assignedAmount: number;
  unassignedAmount: number;
  assignedItemAmount: number;
  totalItemAmount: number;
  assignments: CalculatedItemAssignment[];
  participants: CalculatedParticipantShare[];
  isFullyAssigned: boolean;
};

type WeightedShare = {
  key: string;
  weight: number;
};

function toCents(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('Split amounts must be finite and non-negative.');
  }
  return Math.round((numeric + Number.EPSILON) * 100);
}

function fromCents(value: number): number {
  return value / 100;
}

function allocateEvenly(totalCents: number, userIds: string[]): Map<string, number> {
  const ids = Array.from(new Set(userIds)).sort();
  const result = new Map<string, number>();
  if (ids.length === 0) return result;

  const base = Math.floor(totalCents / ids.length);
  let remainder = totalCents - base * ids.length;

  for (const userId of ids) {
    const extra = remainder > 0 ? 1 : 0;
    result.set(userId, base + extra);
    remainder -= extra;
  }

  return result;
}

function allocateProportionally(totalCents: number, shares: WeightedShare[]): Map<string, number> {
  const result = new Map<string, number>();
  const positiveShares = shares.filter((share) => share.weight > 0);
  const totalWeight = positiveShares.reduce((sum, share) => sum + share.weight, 0);

  if (totalCents <= 0 || totalWeight <= 0) {
    for (const share of positiveShares) result.set(share.key, 0);
    return result;
  }

  const ranked = positiveShares
    .map((share) => {
      const exact = (totalCents * share.weight) / totalWeight;
      const base = Math.floor(exact);
      result.set(share.key, base);
      return { ...share, fraction: exact - base };
    })
    .sort((a, b) => b.fraction - a.fraction || a.key.localeCompare(b.key));

  let remainder =
    totalCents - Array.from(result.values()).reduce((sum, amount) => sum + amount, 0);
  for (let index = 0; remainder > 0; index += 1) {
    const share = ranked[index % ranked.length];
    result.set(share.key, (result.get(share.key) ?? 0) + 1);
    remainder -= 1;
  }

  return result;
}

function allocateSignedProportionally(
  totalCents: number,
  shares: WeightedShare[],
): Map<string, number> {
  if (totalCents >= 0) {
    return allocateProportionally(totalCents, shares);
  }

  return new Map(
    Array.from(allocateProportionally(Math.abs(totalCents), shares), ([key, amount]) => [
      key,
      -amount,
    ]),
  );
}

export function calculateExpenseSplit(input: {
  expense: Pick<Expense, 'total' | 'tax' | 'tip' | 'fees' | 'discount'>;
  items: Pick<ExpenseItem, 'id' | 'line_total'>[];
  selections: ExpenseItemSelections;
}): ExpenseSplitCalculation {
  const receiptTotalCents = toCents(Number(input.expense.total));
  const totalItemCents = input.items.reduce(
    (sum, item) => sum + toCents(Number(item.line_total)),
    0,
  );
  const assignments: CalculatedItemAssignment[] = [];
  const memberItemCents = new Map<string, number>();
  let assignedItemCents = 0;
  let assignedItemCount = 0;

  for (const item of input.items) {
    const itemCents = toCents(Number(item.line_total));
    const selectedUserIds = input.selections[item.id] ?? [];
    const itemShares = allocateEvenly(itemCents, selectedUserIds);

    if (itemShares.size > 0) {
      assignedItemCents += itemCents;
      assignedItemCount += 1;
    }

    for (const [userId, amountCents] of itemShares) {
      assignments.push({
        expenseItemId: item.id,
        userId,
        assignedAmount: fromCents(amountCents),
      });
      memberItemCents.set(userId, (memberItemCents.get(userId) ?? 0) + amountCents);
    }
  }

  const fullyAssigned =
    input.items.length > 0 &&
    totalItemCents > 0 &&
    assignedItemCount === input.items.length;
  const assignedTargetCents =
    totalItemCents === 0
      ? 0
      : fullyAssigned
        ? receiptTotalCents
        : Math.round((receiptTotalCents * assignedItemCents) / totalItemCents);
  const weights = Array.from(memberItemCents, ([key, weight]) => ({ key, weight }));
  const assignedPool = (amountCents: number) =>
    totalItemCents > 0
      ? Math.round((amountCents * assignedItemCents) / totalItemCents)
      : 0;

  const taxByMember = allocateProportionally(
    assignedPool(toCents(Number(input.expense.tax))),
    weights,
  );
  const tipByMember = allocateProportionally(
    assignedPool(toCents(Number(input.expense.tip))),
    weights,
  );
  const feesByMember = allocateProportionally(
    assignedPool(toCents(Number(input.expense.fees))),
    weights,
  );
  const discountByMember = allocateProportionally(
    assignedPool(toCents(Number(input.expense.discount))),
    weights,
  );
  const componentTotalCents = weights.reduce(
    (sum, { key, weight }) =>
      sum +
      weight +
      (taxByMember.get(key) ?? 0) +
      (tipByMember.get(key) ?? 0) +
      (feesByMember.get(key) ?? 0) -
      (discountByMember.get(key) ?? 0),
    0,
  );
  const adjustmentByMember = allocateSignedProportionally(
    assignedTargetCents - componentTotalCents,
    weights,
  );

  const participants = weights
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key: userId, weight }) => {
      const taxCents = taxByMember.get(userId) ?? 0;
      const tipCents = tipByMember.get(userId) ?? 0;
      const feeCents = feesByMember.get(userId) ?? 0;
      const discountCents = discountByMember.get(userId) ?? 0;
      const adjustmentCents = adjustmentByMember.get(userId) ?? 0;
      return {
        userId,
        itemSubtotal: fromCents(weight),
        taxShare: fromCents(taxCents),
        tipShare: fromCents(tipCents),
        feeShare: fromCents(feeCents),
        discountShare: fromCents(discountCents),
        adjustment: fromCents(adjustmentCents),
        totalOwed: fromCents(
          weight + taxCents + tipCents + feeCents - discountCents + adjustmentCents,
        ),
      };
    });

  return {
    receiptTotal: fromCents(receiptTotalCents),
    assignedAmount: fromCents(assignedTargetCents),
    unassignedAmount: fromCents(receiptTotalCents - assignedTargetCents),
    assignedItemAmount: fromCents(assignedItemCents),
    totalItemAmount: fromCents(totalItemCents),
    assignments,
    participants,
    isFullyAssigned: fullyAssigned,
  };
}
