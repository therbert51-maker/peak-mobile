import { useCallback, useEffect, useState } from 'react';

import {
  emptyUserProfile,
  fetchUserProfile,
  saveUserProfile,
  type UserProfile,
  type UserProfileInput,
} from '@/lib/user-profile';

type LoadState = 'idle' | 'loading' | 'success' | 'error';

export function useUserProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(
    userId ? emptyUserProfile(userId) : null,
  );
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoadState('idle');
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);
    const result = await fetchUserProfile(userId);

    if (result.error || !result.data) {
      setErrorMessage(result.error ?? 'Could not load your profile.');
      setLoadState('error');
      return;
    }

    setProfile(result.data);
    setLoadState('success');
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (input: UserProfileInput) => {
      if (!userId) return { data: null, error: 'You must be signed in.' };
      const result = await saveUserProfile(userId, input);
      if (result.data) {
        setProfile(result.data);
        setLoadState('success');
        setErrorMessage(null);
      }
      return result;
    },
    [userId],
  );

  return { profile, loadState, errorMessage, refresh, save };
}
