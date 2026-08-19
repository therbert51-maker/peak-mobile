export type HomeHeaderProfile = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
};

export type HomeHeaderLoadState = 'idle' | 'loading' | 'success' | 'error';

export type HomeHeaderIdentity = {
  greeting: string;
  greetingName: string | null;
  initials: string | null;
  ready: boolean;
};

function initialsFromCurrentProfile(profile: HomeHeaderProfile): string | null {
  const first = profile.firstName.trim();
  const last = profile.lastName.trim();
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }

  const displayParts = profile.displayName.trim().split(/\s+/).filter(Boolean);
  if (displayParts.length >= 2) {
    return `${displayParts[0][0]}${displayParts[1][0]}`.toUpperCase();
  }
  if (displayParts.length === 1 && displayParts[0].length >= 2) {
    return displayParts[0].slice(0, 2).toUpperCase();
  }
  if (first.length >= 2) return first.slice(0, 2).toUpperCase();
  if (first.length === 1) return first.toUpperCase();
  return null;
}

export function homeHeaderIdentity(
  authUserId: string | null | undefined,
  profile: HomeHeaderProfile | null,
  loadState: HomeHeaderLoadState,
): HomeHeaderIdentity {
  const profileMatchesCurrentUser = Boolean(
    authUserId && profile && profile.id === authUserId && loadState === 'success',
  );

  if (!profileMatchesCurrentUser || !profile) {
    return {
      greeting: 'Good evening',
      greetingName: null,
      initials: null,
      ready: false,
    };
  }

  const greetingName =
    profile.firstName.trim() ||
    profile.displayName.trim().split(/\s+/).filter(Boolean)[0] ||
    null;

  return {
    greeting: greetingName ? `Good evening, ${greetingName}` : 'Good evening',
    greetingName,
    initials: initialsFromCurrentProfile(profile),
    ready: true,
  };
}
