import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateExpenseSplit } from './expense-split';

const expense = {
  total: 36.3,
  tax: 2.3,
  tip: 4,
  fees: 0,
  discount: 0,
};

function sumMoney(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

describe('calculateExpenseSplit', () => {
  it('splits an item evenly and reconciles shares to the receipt total', () => {
    const result = calculateExpenseSplit({
      expense,
      items: [
        { id: 'pizza', line_total: 20 },
        { id: 'salad', line_total: 10 },
      ],
      selections: {
        pizza: ['member-b', 'member-a'],
        salad: ['member-b'],
      },
    });

    assert.equal(result.isFullyAssigned, true);
    assert.equal(result.assignedAmount, 36.3);
    assert.equal(result.unassignedAmount, 0);
    assert.deepEqual(
      result.assignments.filter((assignment) => assignment.expenseItemId === 'pizza'),
      [
        { expenseItemId: 'pizza', userId: 'member-a', assignedAmount: 10 },
        { expenseItemId: 'pizza', userId: 'member-b', assignedAmount: 10 },
      ],
    );
    assert.equal(sumMoney(result.participants.map((participant) => participant.totalOwed)), 36.3);
  });

  it('assigns indivisible cents deterministically', () => {
    const result = calculateExpenseSplit({
      expense: { total: 10.01, tax: 0, tip: 0, fees: 0, discount: 0 },
      items: [{ id: 'item', line_total: 10.01 }],
      selections: { item: ['member-c', 'member-a', 'member-b'] },
    });

    assert.deepEqual(result.assignments, [
      { expenseItemId: 'item', userId: 'member-a', assignedAmount: 3.34 },
      { expenseItemId: 'item', userId: 'member-b', assignedAmount: 3.34 },
      { expenseItemId: 'item', userId: 'member-c', assignedAmount: 3.33 },
    ]);
    assert.equal(sumMoney(result.participants.map((participant) => participant.totalOwed)), 10.01);
  });

  it('keeps the unassigned portion of a partially assigned receipt', () => {
    const result = calculateExpenseSplit({
      expense,
      items: [
        { id: 'pizza', line_total: 20 },
        { id: 'salad', line_total: 10 },
      ],
      selections: { pizza: ['member-a', 'member-b'] },
    });

    assert.equal(result.isFullyAssigned, false);
    assert.equal(result.assignedAmount, 24.2);
    assert.equal(result.unassignedAmount, 12.1);
    for (const participant of result.participants) {
      assert.equal(
        sumMoney([
          participant.itemSubtotal,
          participant.taxShare,
          participant.tipShare,
          participant.feeShare,
          -participant.discountShare,
          participant.adjustment,
        ]),
        participant.totalOwed,
      );
    }
  });

  it('allocates proportional tax and tip with exact cent reconciliation', () => {
    const result = calculateExpenseSplit({
      expense: { total: 10.03, tax: 0.67, tip: 0.33, fees: 0, discount: 0 },
      items: [
        { id: 'first', line_total: 3.01 },
        { id: 'second', line_total: 6.02 },
      ],
      selections: {
        first: ['member-a'],
        second: ['member-b'],
      },
    });

    assert.equal(sumMoney(result.participants.map((participant) => participant.taxShare)), 0.67);
    assert.equal(sumMoney(result.participants.map((participant) => participant.tipShare)), 0.33);
    assert.equal(sumMoney(result.participants.map((participant) => participant.totalOwed)), 10.03);
    assert.deepEqual(
      result.participants.map(({ userId, taxShare, tipShare }) => ({
        userId,
        taxShare,
        tipShare,
      })),
      [
        { userId: 'member-a', taxShare: 0.22, tipShare: 0.11 },
        { userId: 'member-b', taxShare: 0.45, tipShare: 0.22 },
      ],
    );
  });

  it('leaves the whole receipt unassigned when no items are selected', () => {
    const result = calculateExpenseSplit({
      expense,
      items: [{ id: 'pizza', line_total: 30 }],
      selections: {},
    });

    assert.equal(result.assignedAmount, 0);
    assert.equal(result.unassignedAmount, 36.3);
    assert.deepEqual(result.participants, []);
  });

  it('allocates fees and discounts and exposes reconciliation adjustments', () => {
    const result = calculateExpenseSplit({
      expense: { total: 35.01, tax: 3, tip: 2, fees: 1, discount: 1 },
      items: [
        { id: 'first', line_total: 10 },
        { id: 'second', line_total: 20 },
      ],
      selections: {
        first: ['member-a'],
        second: ['member-b'],
      },
    });

    assert.equal(sumMoney(result.participants.map((participant) => participant.feeShare)), 1);
    assert.equal(
      sumMoney(result.participants.map((participant) => participant.discountShare)),
      1,
    );
    assert.equal(
      sumMoney(result.participants.map((participant) => participant.adjustment)),
      0.01,
    );
    assert.equal(sumMoney(result.participants.map((participant) => participant.totalOwed)), 35.01);
  });
});
