import type { ParsedReceiptPayload } from '@/lib/receipt/types';

/** Normalize model output before validation (trim strings, coerce obvious numbers). */
export function normalizeRawReceiptPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;

  const body = { ...(raw as Record<string, unknown>) };

  if (typeof body.expense_title === 'string') body.expense_title = body.expense_title.trim();
  if (typeof body.merchant_name === 'string') body.merchant_name = body.merchant_name.trim();
  if (typeof body.original_currency === 'string') {
    body.original_currency = body.original_currency.trim().toUpperCase();
  }

  if (Array.isArray(body.items)) {
    body.items = body.items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const row = { ...(item as Record<string, unknown>) };
      if (typeof row.name === 'string') row.name = row.name.trim();
      return row;
    });
  }

  return body;
}

export function receiptPlaceholderTitle(payload: ParsedReceiptPayload): string {
  return payload.merchant_name?.trim() || payload.expense_title.trim() || 'Receipt';
}
