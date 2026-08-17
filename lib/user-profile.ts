import { formatSupabaseError } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  preferredCurrency: SupportedCurrency;
  updatedAt: string | null;
};

export type UserProfileInput = Pick<
  UserProfile,
  'firstName' | 'lastName' | 'displayName' | 'preferredCurrency'
>;

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  preferred_currency: string;
  updated_at: string | null;
};

const PROFILE_COLUMNS =
  'id, first_name, last_name, display_name, avatar_url, preferred_currency, updated_at';

function isSupportedCurrency(value: string): value is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(value as SupportedCurrency);
}

function toUserProfile(row: ProfileRow): UserProfile {
  const currency = row.preferred_currency?.toUpperCase() ?? 'USD';
  return {
    id: row.id,
    firstName: row.first_name?.trim() ?? '',
    lastName: row.last_name?.trim() ?? '',
    displayName: row.display_name?.trim() ?? '',
    avatarUrl: row.avatar_url,
    preferredCurrency: isSupportedCurrency(currency) ? currency : 'USD',
    updatedAt: row.updated_at,
  };
}

export function emptyUserProfile(userId: string): UserProfile {
  return {
    id: userId,
    firstName: '',
    lastName: '',
    displayName: '',
    avatarUrl: null,
    preferredCurrency: 'USD',
    updatedAt: null,
  };
}

export function profileDisplayName(profile: UserProfile, email?: string | null): string {
  if (profile.displayName) return profile.displayName;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  if (fullName) return fullName;
  return email?.split('@')[0] || 'Peak traveler';
}

export function profileInitials(profile: UserProfile, email?: string | null): string {
  const name = profileDisplayName(profile, email);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export async function fetchUserProfile(
  userId: string,
): Promise<{ data: UserProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) return { data: null, error: formatSupabaseError(error) };
  if (!data) return { data: emptyUserProfile(userId), error: null };
  return { data: toUserProfile(data as ProfileRow), error: null };
}

export async function saveUserProfile(
  userId: string,
  input: UserProfileInput,
): Promise<{ data: UserProfile | null; error: string | null }> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const displayName = input.displayName.trim();

  if (firstName.length > 80 || lastName.length > 80 || displayName.length > 100) {
    return { data: null, error: 'Profile names are too long.' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        first_name: firstName || null,
        last_name: lastName || null,
        display_name: displayName || null,
        preferred_currency: input.preferredCurrency,
      },
      { onConflict: 'id' },
    )
    .select(PROFILE_COLUMNS)
    .single();

  if (error || !data) {
    return {
      data: null,
      error: error ? formatSupabaseError(error) : 'Could not save your profile.',
    };
  }

  return { data: toUserProfile(data as ProfileRow), error: null };
}
