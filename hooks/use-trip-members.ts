import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { fetchTripMembers, type TripMember } from '@/lib/trip-members';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

type UseTripMembersOptions = {
  /** Reload members whenever the screen gains focus (e.g. after Supabase membership changes). */
  refreshOnFocus?: boolean;
};

export function useTripMembers(
  spaceId: string | undefined,
  ownerId: string | null | undefined,
  options?: UseTripMembersOptions,
) {
  const refreshOnFocus = options?.refreshOnFocus ?? false;
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
    if (!refreshOnFocus) {
      void refresh();
    }
  }, [refresh, refreshOnFocus]);

  useFocusEffect(
    useCallback(() => {
      if (refreshOnFocus) {
        void refresh();
      }
    }, [refresh, refreshOnFocus]),
  );

  return { members, loadState, errorMessage, refresh };
}
