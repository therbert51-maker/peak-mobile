import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';

import { subscribeInspirationSaved } from '@/lib/inspiration-refresh';

/**
 * Refetch when the screen gains focus or after inspiration is saved (optionally scoped to a space).
 */
export function useInspirationRefresh(
  onRefresh: () => void,
  options?: { spaceId?: string | null },
): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const spaceIdRef = useRef(options?.spaceId);
  spaceIdRef.current = options?.spaceId;

  useFocusEffect(
    useCallback(() => {
      onRefreshRef.current();
    }, []),
  );

  useEffect(() => {
    return subscribeInspirationSaved((savedSpaceId) => {
      const scopedSpaceId = spaceIdRef.current;
      if (
        scopedSpaceId != null &&
        savedSpaceId != null &&
        scopedSpaceId !== savedSpaceId
      ) {
        return;
      }
      onRefreshRef.current();
    });
  }, []);
}
