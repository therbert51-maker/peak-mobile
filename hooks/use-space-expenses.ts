import { useCallback, useEffect, useState } from 'react';

import {
  createManualExpense,
  fetchManualExpensesForSpace,
  type CreateManualExpenseInput,
  type ManualExpense,
} from '@/lib/expenses';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

export function useSpaceExpenses(spaceId: string | undefined) {
  const [expenses, setExpenses] = useState<ManualExpense[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!spaceId) {
      setExpenses([]);
      setLoadState('idle');
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    const { data, error } = await fetchManualExpensesForSpace(spaceId);

    if (error) {
      setErrorMessage(error);
      setExpenses([]);
      setLoadState('error');
      return;
    }

    setExpenses(data ?? []);
    setLoadState('success');
  }, [spaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addExpense = useCallback(
    async (input: CreateManualExpenseInput) => {
      const { data, error } = await createManualExpense(input);

      if (error || !data) {
        return { ok: false as const, error: error ?? 'Could not save expense.' };
      }

      setExpenses((prev) => [data, ...prev]);
      setLoadState('success');
      setErrorMessage(null);
      return { ok: true as const, data };
    },
    [],
  );

  return {
    expenses,
    loadState,
    errorMessage,
    refresh,
    addExpense,
  };
}
