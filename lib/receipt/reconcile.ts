import type { ParsedReceiptItem, ReceiptReconciliation } from '@/lib/receipt/types';

export function sumLineItems(items: Pick<ParsedReceiptItem, 'line_total'>[]): number {
  return items.reduce((sum, item) => sum + item.line_total, 0);
}

export function computeReceiptReconciliation(input: {
  items: Pick<ParsedReceiptItem, 'line_total'>[];
  subtotal: number | null;
  tax: number;
  tip: number;
  fees: number;
  discount: number;
  total: number;
}): ReceiptReconciliation {
  const itemsSum = roundMoney(sumLineItems(input.items));
  const subtotalBase = input.subtotal ?? itemsSum;
  const expectedTotal = roundMoney(subtotalBase + input.tax + input.tip + input.fees - input.discount);
  const reportedTotal = roundMoney(input.total);
  const delta = roundMoney(reportedTotal - expectedTotal);

  return {
    itemsSum,
    expectedTotal,
    reportedTotal,
    delta,
    matches: Math.abs(delta) < 0.02,
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
