import { router } from 'expo-router';

import type { ManualExpense } from '@/lib/expenses';

type ExpenseRoute = {
  pathname:
    | '/spaces/[id]/expenses/processing'
    | '/spaces/[id]/expenses/[expenseId]/review'
    | '/spaces/[id]/expenses/[expenseId]';
  params: { id: string; expenseId: string };
};

export type ExpensesEntryFrom = 'home' | 'split';

/** Canonical href for the space Expenses list screen. */
export function spaceExpensesHref(spaceId: string): `/spaces/${string}/expenses`;
export function spaceExpensesHref(
  spaceId: string,
  from: ExpensesEntryFrom,
): `/spaces/${string}/expenses?from=${ExpensesEntryFrom}`;
export function spaceExpensesHref(spaceId: string, from?: ExpensesEntryFrom): string {
  const base = `/spaces/${spaceId}/expenses`;
  return from ? `${base}?from=${from}` : base;
}

export function parseExpensesEntryFrom(value: string | string[] | undefined): ExpensesEntryFrom | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'home' || raw === 'split') {
    return raw;
  }
  return null;
}

export function navigateBackFromExpenses(input: {
  spaceId: string | undefined;
  from: ExpensesEntryFrom | null;
}): void {
  const { spaceId, from } = input;

  if (from === 'split') {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/split');
    }
    return;
  }

  if (from === 'home') {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
    return;
  }

  if (router.canGoBack()) {
    router.back();
    return;
  }

  if (spaceId) {
    router.replace(`/spaces/${spaceId}`);
    return;
  }

  router.replace('/(tabs)');
}

export function resolveActiveSpaceId(
  spaces: { id: string }[],
  activeSpaceId: string | null,
): string | null {
  if (activeSpaceId && spaces.some((space) => space.id === activeSpaceId)) {
    return activeSpaceId;
  }
  return spaces[0]?.id ?? null;
}

export function canManageExpense(expense: ManualExpense, userId: string | undefined): boolean {
  return Boolean(userId && expense.createdBy === userId);
}

/** Tap target: detail for saved expenses, review/processing for in-progress scans. */
export function expenseOpenRoute(spaceId: string, expense: ManualExpense): ExpenseRoute {
  const status = expense.receiptStatus;

  if (status === 'processing' || status === 'uploaded') {
    return {
      pathname: '/spaces/[id]/expenses/processing',
      params: { id: spaceId, expenseId: expense.id },
    };
  }

  if (status === 'needs_review' || status === 'failed') {
    return {
      pathname: '/spaces/[id]/expenses/[expenseId]/review',
      params: { id: spaceId, expenseId: expense.id },
    };
  }

  return {
    pathname: '/spaces/[id]/expenses/[expenseId]',
    params: { id: spaceId, expenseId: expense.id },
  };
}

/** Edit target: review screen, or processing for scans still in flight. */
export function expenseEditRoute(spaceId: string, expense: ManualExpense): ExpenseRoute {
  const status = expense.receiptStatus;

  if (status === 'processing' || status === 'uploaded') {
    return {
      pathname: '/spaces/[id]/expenses/processing',
      params: { id: spaceId, expenseId: expense.id },
    };
  }

  return {
    pathname: '/spaces/[id]/expenses/[expenseId]/review',
    params: { id: spaceId, expenseId: expense.id },
  };
}
