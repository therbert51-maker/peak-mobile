import { useCallback, useEffect, useState } from 'react';

import { fetchTripBalanceSummary } from '@/lib/trip-balances-api';
import type { TripBalanceSummary } from '@/lib/trip-balances';
import type { TripMember } from '@/lib/trip-members';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

export function useTripBalances(spaceId: string | undefined, members: TripMember[]) {
  const [summary, setSummary] = useState<TripBalanceSummary>({
    currencies: [],
    finalizedExpenseCount: 0,
  });
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!spaceId) {
      setSummary({ currencies: [], finalizedExpenseCount: 0 });
      setLoadState('idle');
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    const result = await fetchTripBalanceSummary(spaceId, members);

    if (result.error || !result.data) {
      setErrorMessage(result.error ?? 'Could not load trip balances.');
      setSummary({ currencies: [], finalizedExpenseCount: 0 });
      setLoadState('error');
      return;
    }

    setSummary(result.data);
    setLoadState('success');
  }, [members, spaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, loadState, errorMessage, refresh };
}
