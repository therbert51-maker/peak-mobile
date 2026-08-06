import { formatSupabaseError } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export type TripMember = {
  userId: string;
  role: 'owner' | 'member';
  profile: Pick<Profile, 'id' | 'email' | 'full_name' | 'avatar_url'> | null;
};

export function tripMemberDisplayName(member: TripMember): string {
  const profile = member.profile;
  if (!profile) return 'Member';
  return profile.full_name?.trim() || profile.email?.trim() || 'Member';
}

export function tripMemberInitials(member: TripMember): string {
  const name = tripMemberDisplayName(member);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

type MemberRow = {
  user_id: string;
  role: string;
};

async function fetchProfilesForUserIds(
  userIds: string[],
): Promise<Map<string, TripMember['profile']>> {
  const map = new Map<string, TripMember['profile']>();
  if (userIds.length === 0) return map;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('id', userIds);

  if (error) {
    console.warn('[trip-members] Could not load profiles:', error.message);
    return map;
  }

  for (const profile of data ?? []) {
    map.set(profile.id, profile);
  }

  return map;
}

async function resolveSpaceOwnerId(
  spaceId: string,
  ownerId: string | null,
): Promise<string | null> {
  if (ownerId) return ownerId;

  const { data, error } = await supabase
    .from('spaces')
    .select('owner_id')
    .eq('id', spaceId)
    .maybeSingle();

  if (error) {
    console.warn('[trip-members] Could not load space owner:', error.message);
    return null;
  }

  return data?.owner_id ?? null;
}

async function buildMemberList(
  memberRows: MemberRow[] | null,
  ownerId: string | null,
): Promise<TripMember[]> {
  const byUserId = new Map<string, TripMember>();

  for (const row of memberRows ?? []) {
    const userId = row.user_id;
    const role = row.role === 'owner' ? 'owner' : 'member';
    byUserId.set(userId, { userId, role, profile: null });
  }

  if (ownerId) {
    const existing = byUserId.get(ownerId);
    if (existing) {
      existing.role = 'owner';
    } else {
      byUserId.set(ownerId, { userId: ownerId, role: 'owner', profile: null });
    }
  }

  const userIds = Array.from(byUserId.keys());
  const profilesById = await fetchProfilesForUserIds(userIds);

  for (const [userId, member] of byUserId) {
    member.profile = profilesById.get(userId) ?? null;
  }

  const list = Array.from(byUserId.values());
  list.sort((a, b) => {
    if (a.role === 'owner') return -1;
    if (b.role === 'owner') return 1;
    return tripMemberDisplayName(a).localeCompare(tripMemberDisplayName(b));
  });

  return list;
}

export async function fetchTripMembers(
  spaceId: string,
  ownerId: string | null,
): Promise<{
  data: TripMember[] | null;
  error: string | null;
}> {
  const resolvedOwnerId = await resolveSpaceOwnerId(spaceId, ownerId);

  const { data: memberRows, error: membersError } = await supabase
    .from('space_members')
    .select('user_id, role')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: true });

  if (membersError) {
    if (resolvedOwnerId) {
      const fallback = await buildMemberList([], resolvedOwnerId);
      return { data: fallback, error: null };
    }
    return { data: null, error: formatSupabaseError(membersError) };
  }

  const list = await buildMemberList((memberRows as MemberRow[] | null) ?? [], resolvedOwnerId);
  return { data: list, error: null };
}
