import { useCallback, useEffect, useState } from 'react';

import { fetchTripMembers, type TripMember } from '@/lib/trip-members';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

export function useTripMembers(spaceId: string | undefined, ownerId: string | null | undefined) {
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!spaceId) {
      setMembers([]);
      setLoadState('idle');
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    const { data, error } = await fetchTripMembers(spaceId, ownerId ?? null);

    if (error) {
      setErrorMessage(error);
      setMembers([]);
      setLoadState('error');
      return;
    }

    setMembers(data ?? []);
    setLoadState('success');
  }, [ownerId, spaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { members, loadState, errorMessage, refresh };
}
