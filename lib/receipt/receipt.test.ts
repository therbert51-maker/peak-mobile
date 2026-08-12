import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeRawReceiptPayload } from './normalize';
import { computeReceiptReconciliation } from './reconcile';
import { validateParsedReceiptPayload } from './validate-parsed-receipt';

describe('validateParsedReceiptPayload', () => {
  it('accepts a valid payload', () => {
    const result = validateParsedReceiptPayload({
      merchant_name: 'Cafe',
      expense_title: 'Cafe lunch',
      expense_date: '2026-08-01',
      original_currency: 'eur',
      subtotal: 20,
      tax: 2,
      tip: 3,
      fees: 0,
      discount: 0,
      total: 25,
      items: [
        {
          name: 'Sandwich',
          quantity: 1,
          unit_price: 20,
          line_total: 20,
          category: 'food',
          source_text: 'Sandwich',
          confidence: 0.9,
        },
      ],
      warnings: [],
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.original_currency, 'EUR');
      assert.equal(result.data.items.length, 1);
    }
  });

  it('rejects missing total/items', () => {
    const result = validateParsedReceiptPayload({
      merchant_name: null,
      expense_title: 'Empty',
      expense_date: null,
      original_currency: 'USD',
      subtotal: null,
      tax: 0,
      tip: 0,
      fees: 0,
      discount: 0,
      total: 0,
      items: [],
      warnings: [],
    });

    assert.equal(result.ok, false);
  });
});

describe('normalizeRawReceiptPayload', () => {
  it('trims strings and uppercases currency', () => {
    const normalized = normalizeRawReceiptPayload({
      expense_title: '  Dinner  ',
      original_currency: 'usd',
      items: [{ name: '  Pasta ' }],
    }) as Record<string, unknown>;

    assert.equal(normalized.expense_title, 'Dinner');
    assert.equal(normalized.original_currency, 'USD');
  });
});

describe('computeReceiptReconciliation', () => {
  it('detects matching totals', () => {
    const result = computeReceiptReconciliation({
      items: [{ line_total: 10 }, { line_total: 5 }],
      subtotal: 15,
      tax: 1.5,
      tip: 0,
      fees: 0,
      discount: 0,
      total: 16.5,
    });

    assert.equal(result.matches, true);
    assert.equal(result.delta, 0);
  });

  it('detects mismatched totals', () => {
    const result = computeReceiptReconciliation({
      items: [{ line_total: 10 }],
      subtotal: 10,
      tax: 1,
      tip: 0,
      fees: 0,
      discount: 0,
      total: 15,
    });

    assert.equal(result.matches, false);
    assert.ok(result.delta !== 0);
  });
});
