import { router, type Href } from 'expo-router';

/**
 * Drop invite/auth screens and enter the authenticated app on the joined Space,
 * with tab navigation (Home, Profile, etc.) immediately underneath.
 */
export function resetToJoinedSpace(spaceId: string): void {
  router.dismissTo('/(tabs)' as Href);
  requestAnimationFrame(() => {
    router.push(`/spaces/${spaceId}` as Href);
  });
}

export function resetToSignIn(): void {
  router.dismissTo('/sign-in' as Href);
}
