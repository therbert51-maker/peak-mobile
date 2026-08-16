export type SettlementTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export function toCents(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.round((numeric + Number.EPSILON) * 100);
}

export function fromCents(value: number): number {
  return value / 100;
}

/**
 * Greedy largest-debtor/largest-creditor matching.
 * Produces at most n - 1 transfers and reconciles exactly in integer cents.
 */
export function simplifySettlements(
  netBalancesCents: Map<string, number>,
): SettlementTransfer[] {
  const creditors: { userId: string; cents: number }[] = [];
  const debtors: { userId: string; cents: number }[] = [];

  for (const [userId, cents] of netBalancesCents) {
    if (cents > 0) {
      creditors.push({ userId, cents });
    } else if (cents < 0) {
      debtors.push({ userId, cents: -cents });
    }
  }

  creditors.sort((a, b) => b.cents - a.cents || a.userId.localeCompare(b.userId));
  debtors.sort((a, b) => b.cents - a.cents || a.userId.localeCompare(b.userId));

  const transfers: SettlementTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountCents = Math.min(debtor.cents, creditor.cents);

    if (amountCents > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: fromCents(amountCents),
      });
    }

    debtor.cents -= amountCents;
    creditor.cents -= amountCents;

    if (debtor.cents === 0) debtorIndex += 1;
    if (creditor.cents === 0) creditorIndex += 1;
  }

  return transfers;
}
