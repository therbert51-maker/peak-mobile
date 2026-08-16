import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deriveExpenseSettlement } from './expense-settlement';

describe('deriveExpenseSettlement', () => {
  it('makes each non-payer owe the payer their saved share', () => {
    const result = deriveExpenseSettlement({
      payerId: 'ty',
      expenseTotal: 120,
      participants: [
        { user_id: 'ty', total_owed: 40 },
        { user_id: 'alex', total_owed: 50 },
        { user_id: 'sam', total_owed: 30 },
      ],
    });

    assert.deepEqual(result, {
      payerId: 'ty',
      paidAmount: 120,
      payerShare: 40,
      amountOwedToPayer: 80,
      debtors: [
        { userId: 'alex', amount: 50 },
        { userId: 'sam', amount: 30 },
      ],
    });
  });

  it('never includes the payer as a debtor', () => {
    const result = deriveExpenseSettlement({
      payerId: 'payer',
      expenseTotal: 25,
      participants: [{ user_id: 'payer', total_owed: 25 }],
    });

    assert.equal(result?.payerShare, 25);
    assert.equal(result?.amountOwedToPayer, 0);
    assert.deepEqual(result?.debtors, []);
  });

  it('returns no settlement before participant shares are saved', () => {
    assert.equal(
      deriveExpenseSettlement({
        payerId: 'payer',
        expenseTotal: 10,
        participants: [],
      }),
      null,
    );
  });
});
