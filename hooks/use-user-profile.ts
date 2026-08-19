import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [loadState, setLoadState] = useState<LoadState>(userId ? 'loading' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    const requestedUserId = userId;

    if (!requestedUserId) {
      setProfile(null);
      setLoadState('idle');
      setErrorMessage(null);
      return;
    }

    setProfile((current) =>
      current?.id === requestedUserId ? current : emptyUserProfile(requestedUserId),
    );
    setLoadState('loading');
    setErrorMessage(null);
    const result = await fetchUserProfile(requestedUserId);
    if (generation !== generationRef.current) return;

    if (result.error || !result.data || result.data.id !== requestedUserId) {
      setErrorMessage(result.error ?? 'Could not load your profile.');
      setLoadState('error');
      return;
    }

    setProfile(result.data);
    setLoadState('success');
  }, [userId]);

  useEffect(() => {
    void refresh();
    return () => {
      generationRef.current += 1;
    };
  }, [refresh]);

  const save = useCallback(
    async (input: UserProfileInput) => {
      if (!userId) return { data: null, error: 'You must be signed in.' };
      const requestedUserId = userId;
      const result = await saveUserProfile(requestedUserId, input);
      if (result.data?.id === requestedUserId) {
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
