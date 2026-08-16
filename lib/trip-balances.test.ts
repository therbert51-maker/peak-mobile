import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeTripBalances } from './trip-balances';
import type { ManualExpense } from './expenses';

const members = [
  { userId: 'ty', role: 'owner' as const, profile: null },
  { userId: 'alex', role: 'member' as const, profile: null },
  { userId: 'sam', role: 'member' as const, profile: null },
];

describe('computeTripBalances', () => {
  it('aggregates paid, share, and net balances for finalized splits only', () => {
    const expenses: ManualExpense[] = [
      {
        id: 'exp-1',
        spaceId: 'space',
        title: 'Dinner',
        amount: 120,
        currency: 'USD',
        paidBy: 'ty',
        createdBy: 'ty',
        createdAt: '2026-01-01',
        receiptStatus: 'ready',
      },
    ];

    const summary = computeTripBalances({
      expenses,
      participants: [
        { expenseId: 'exp-1', userId: 'ty', totalOwed: 40 },
        { expenseId: 'exp-1', userId: 'alex', totalOwed: 50 },
        { expenseId: 'exp-1', userId: 'sam', totalOwed: 30 },
      ],
      members,
    });

    assert.equal(summary.finalizedExpenseCount, 1);
    assert.equal(summary.currencies.length, 1);

    const usd = summary.currencies[0];
    assert.equal(usd.currency, 'USD');
    assert.deepEqual(
      usd.members.map((member) => ({
        userId: member.userId,
        paid: member.paid,
        share: member.share,
        net: member.net,
      })),
      [
        { userId: 'ty', paid: 120, share: 40, net: 80 },
        { userId: 'alex', paid: 0, share: 50, net: -50 },
        { userId: 'sam', paid: 0, share: 30, net: -30 },
      ],
    );
    assert.deepEqual(usd.transfers, [
      { fromUserId: 'alex', toUserId: 'ty', amount: 50 },
      { fromUserId: 'sam', toUserId: 'ty', amount: 30 },
    ]);
  });

  it('keeps currencies separate', () => {
    const expenses: ManualExpense[] = [
      {
        id: 'usd-exp',
        spaceId: 'space',
        title: 'USD meal',
        amount: 10,
        currency: 'USD',
        paidBy: 'ty',
        createdBy: 'ty',
        createdAt: '2026-01-01',
        receiptStatus: 'manual',
      },
      {
        id: 'eur-exp',
        spaceId: 'space',
        title: 'EUR meal',
        amount: 20,
        currency: 'EUR',
        paidBy: 'alex',
        createdBy: 'alex',
        createdAt: '2026-01-02',
        receiptStatus: 'manual',
      },
    ];

    const summary = computeTripBalances({
      expenses,
      participants: [
        { expenseId: 'usd-exp', userId: 'ty', totalOwed: 5 },
        { expenseId: 'usd-exp', userId: 'alex', totalOwed: 5 },
        { expenseId: 'eur-exp', userId: 'alex', totalOwed: 10 },
        { expenseId: 'eur-exp', userId: 'sam', totalOwed: 10 },
      ],
      members,
    });

    assert.equal(summary.currencies.length, 2);
    assert.equal(summary.currencies[0]?.currency, 'EUR');
    assert.equal(summary.currencies[1]?.currency, 'USD');
  });

  it('excludes expenses without finalized participant shares', () => {
    const expenses: ManualExpense[] = [
      {
        id: 'split-exp',
        spaceId: 'space',
        title: 'Split dinner',
        amount: 30,
        currency: 'USD',
        paidBy: 'ty',
        createdBy: 'ty',
        createdAt: '2026-01-01',
        receiptStatus: 'ready',
      },
      {
        id: 'unsplit-exp',
        spaceId: 'space',
        title: 'Needs split',
        amount: 40,
        currency: 'USD',
        paidBy: 'alex',
        createdBy: 'alex',
        createdAt: '2026-01-02',
        receiptStatus: 'ready',
      },
      {
        id: 'failed-exp',
        spaceId: 'space',
        title: 'Failed scan',
        amount: 15,
        currency: 'USD',
        paidBy: 'sam',
        createdBy: 'sam',
        createdAt: '2026-01-03',
        receiptStatus: 'failed',
      },
    ];

    const summary = computeTripBalances({
      expenses,
      participants: [{ expenseId: 'split-exp', userId: 'ty', totalOwed: 30 }],
      members,
    });

    assert.equal(summary.finalizedExpenseCount, 1);
    assert.equal(summary.currencies[0]?.members.length, 1);
    assert.equal(summary.currencies[0]?.members[0]?.paid, 30);
  });
});
