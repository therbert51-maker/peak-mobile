import type { ParsedReceiptItem, ParsedReceiptPayload } from './types.ts';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampConfidence(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function validateItem(raw: unknown, index: number): ParsedReceiptItem | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: `Item ${index + 1} is not an object.` };
  }

  const row = raw as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!name) {
    return { error: `Item ${index + 1} is missing a name.` };
  }

  if (!isFiniteNumber(row.quantity) || row.quantity <= 0) {
    return { error: `Item ${index + 1} has an invalid quantity.` };
  }

  const unit_price =
    row.unit_price === null || row.unit_price === undefined
      ? null
      : isFiniteNumber(row.unit_price) && row.unit_price >= 0
        ? row.unit_price
        : null;

  if (!isFiniteNumber(row.line_total) || row.line_total < 0) {
    return { error: `Item ${index + 1} has an invalid line total.` };
  }

  if (!isFiniteNumber(row.confidence)) {
    return { error: `Item ${index + 1} is missing confidence.` };
  }

  const category =
    row.category === null || row.category === undefined
      ? null
      : typeof row.category === 'string'
        ? row.category.trim() || null
        : null;

  const source_text =
    row.source_text === null || row.source_text === undefined
      ? null
      : typeof row.source_text === 'string'
        ? row.source_text.trim() || null
        : null;

  return {
    name,
    quantity: row.quantity,
    unit_price,
    line_total: row.line_total,
    category,
    source_text,
    confidence: clampConfidence(row.confidence),
  };
}

export function validateParsedReceiptPayload(
  raw: unknown,
): { ok: true; data: ParsedReceiptPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Receipt payload is not an object.' };
  }

  const body = raw as Record<string, unknown>;

  const expense_title =
    typeof body.expense_title === 'string' ? body.expense_title.trim() : '';
  if (!expense_title) {
    return { ok: false, error: 'Missing expense title.' };
  }

  const original_currency =
    typeof body.original_currency === 'string' ? body.original_currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(original_currency)) {
    return { ok: false, error: 'Invalid original currency code.' };
  }

  const merchant_name =
    body.merchant_name === null || body.merchant_name === undefined
      ? null
      : typeof body.merchant_name === 'string'
        ? body.merchant_name.trim() || null
        : null;

  let expense_date: string | null = null;
  if (body.expense_date !== null && body.expense_date !== undefined && body.expense_date !== '') {
    if (typeof body.expense_date !== 'string' || !ISO_DATE.test(body.expense_date)) {
      return { ok: false, error: 'Invalid expense date (expected YYYY-MM-DD).' };
    }
    expense_date = body.expense_date;
  }

  const subtotal =
    body.subtotal === null || body.subtotal === undefined
      ? null
      : isFiniteNumber(body.subtotal) && body.subtotal >= 0
        ? body.subtotal
        : null;

  for (const key of ['tax', 'tip', 'fees', 'discount', 'total'] as const) {
    if (!isFiniteNumber(body[key])) {
      return { ok: false, error: `Missing or invalid ${key}.` };
    }
  }

  const tax = body.tax as number;
  const tip = body.tip as number;
  const fees = body.fees as number;
  const discount = body.discount as number;
  const total = body.total as number;

  if (tax < 0 || tip < 0 || fees < 0 || total < 0) {
    return { ok: false, error: 'Tax, tip, fees, and total must be zero or greater.' };
  }

  if (!Array.isArray(body.items)) {
    return { ok: false, error: 'Items must be an array.' };
  }

  const items: ParsedReceiptItem[] = [];
  for (let i = 0; i < body.items.length; i++) {
    const itemResult = validateItem(body.items[i], i);
    if ('error' in itemResult) {
      return { ok: false, error: itemResult.error };
    }
    items.push(itemResult);
  }

  if (total === 0 && items.length === 0) {
    return { ok: false, error: 'Receipt has no recognizable total or items.' };
  }

  const warnings = Array.isArray(body.warnings)
    ? body.warnings.filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
    : [];

  return {
    ok: true,
    data: {
      merchant_name,
      expense_title,
      expense_date,
      original_currency,
      subtotal,
      tax,
      tip,
      fees,
      discount,
      total,
      items,
      warnings,
    },
  };
}

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
