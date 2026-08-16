import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fromCents, simplifySettlements, toCents } from './trip-settlement';

describe('trip settlement simplification', () => {
  it('creates direct debtor-to-creditor transfers that reconcile exactly', () => {
    const balances = new Map<string, number>([
      ['ty', toCents(80)],
      ['alex', toCents(-50)],
      ['sam', toCents(-30)],
    ]);

    assert.deepEqual(simplifySettlements(balances), [
      { fromUserId: 'alex', toUserId: 'ty', amount: 50 },
      { fromUserId: 'sam', toUserId: 'ty', amount: 30 },
    ]);
  });

  it('handles multiple creditors with integer cents', () => {
    const balances = new Map<string, number>([
      ['a', toCents(33.33)],
      ['b', toCents(-10.01)],
      ['c', toCents(-23.32)],
    ]);

    const transfers = simplifySettlements(balances);
    const totalPaid = transfers.reduce((sum, transfer) => sum + toCents(transfer.amount), 0);
    const totalReceived = transfers.reduce((sum, transfer) => sum + toCents(transfer.amount), 0);

    assert.equal(totalPaid, toCents(33.33));
    assert.equal(totalReceived, toCents(33.33));
    assert.equal(transfers.every((transfer) => Number.isInteger(toCents(transfer.amount))), true);
  });

  it('returns no transfers when everyone is settled', () => {
    const balances = new Map<string, number>([
      ['a', 0],
      ['b', 0],
    ]);

    assert.deepEqual(simplifySettlements(balances), []);
  });

  it('round-trips cents without floating-point drift', () => {
    assert.equal(fromCents(toCents(12.345)), 12.35);
  });
});
