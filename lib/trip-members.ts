import { formatSupabaseError } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';

/** Public profile fields used to label members throughout Split and Settle Up. */
export type TripMemberProfile = {
  id: string;
  avatar_url: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null;
};

export type TripMember = {
  userId: string;
  role: 'owner' | 'member';
  profile: TripMemberProfile | null;
};

export function tripMemberDisplayName(member: TripMember): string {
  const profile = member.profile;
  const structuredName = `${profile?.first_name?.trim() ?? ''} ${
    profile?.last_name?.trim() ?? ''
  }`.trim();
  const fromProfile =
    profile?.display_name?.trim() ||
    structuredName ||
    profile?.full_name?.trim() ||
    profile?.email?.trim();
  if (fromProfile) return fromProfile;
  if (member.role === 'owner') return 'Owner';
  return 'Member';
}

export function tripMemberInitials(member: TripMember): string {
  const displayName = tripMemberDisplayName(member);
  if (displayName !== 'Owner' && displayName !== 'Member') {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }
  return member.userId.replace(/-/g, '').slice(0, 2).toUpperCase();
}

type MemberRow = {
  user_id: string;
  role: string;
};

async function fetchSpaceMemberRows(spaceId: string): Promise<{
  data: MemberRow[] | null;
  error: string | null;
}> {
  const ordered = await supabase
    .from('space_members')
    .select('user_id, role')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: true });

  if (!ordered.error) {
    return { data: (ordered.data as MemberRow[] | null) ?? [], error: null };
  }

  console.warn('[trip-members] space_members ordered query failed:', ordered.error.message);

  const plain = await supabase
    .from('space_members')
    .select('user_id, role')
    .eq('space_id', spaceId);

  if (plain.error) {
    return { data: null, error: formatSupabaseError(plain.error) };
  }

  return { data: (plain.data as MemberRow[] | null) ?? [], error: null };
}

async function fetchProfilesForUserIds(
  userIds: string[],
): Promise<Map<string, TripMemberProfile>> {
  const map = new Map<string, TripMemberProfile>();
  if (userIds.length === 0) return map;

  // These fields are established by the Settings + Profile v1 migration.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, avatar_url, first_name, last_name, display_name')
    .in('id', userIds);

  if (error) {
    console.warn('[trip-members] Could not load profiles:', error.message);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, {
      id: row.id,
      avatar_url: row.avatar_url,
      first_name: row.first_name,
      last_name: row.last_name,
      display_name: row.display_name,
    });
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
  memberRows: MemberRow[],
  ownerId: string | null,
): Promise<TripMember[]> {
  const byUserId = new Map<string, TripMember>();

  for (const row of memberRows) {
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
  const [resolvedOwnerId, membersResult] = await Promise.all([
    resolveSpaceOwnerId(spaceId, ownerId),
    fetchSpaceMemberRows(spaceId),
  ]);

  if (membersResult.error) {
    return { data: null, error: membersResult.error };
  }

  const list = await buildMemberList(membersResult.data ?? [], resolvedOwnerId);
  return { data: list, error: null };
}
