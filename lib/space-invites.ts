import * as Linking from 'expo-linking';

import { formatSupabaseError } from '@/lib/spaces';
import {
  effectiveInviteStatus,
  type InviteStatus,
} from '@/lib/space-invite-status';
import { supabase } from '@/lib/supabase';
import type { SpaceInvite } from '@/types/database';

export { effectiveInviteStatus };
export type { InviteStatus };

export type SpaceInvitePreview = {
  inviteId: string;
  status: InviteStatus;
  expiresAt: string;
  invitedEmailHint: string;
  spaceName: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  invitedByName: string;
};

export type InviteAcceptance = {
  spaceId: string;
  outcome: 'joined' | 'already_member';
};

export type ManagedSpaceInvite = SpaceInvite;
export type CreatedSpaceInvite = Pick<
  SpaceInvite,
  'id' | 'space_id' | 'invited_email' | 'token' | 'status' | 'created_at' | 'expires_at'
>;

function firstRow<T>(data: T[] | null): T | null {
  return data?.[0] ?? null;
}

export function buildSpaceInviteLink(token: string): string {
  return Linking.createURL(`invite/${token}`);
}

export async function createSpaceInvite(
  spaceId: string,
  email: string,
): Promise<{ data: CreatedSpaceInvite | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_space_invite', {
    p_space_id: spaceId,
    p_invited_email: email.trim(),
  });

  if (error) return { data: null, error: formatSupabaseError(error) };
  const row = firstRow(data);
  if (!row) return { data: null, error: 'Could not create this invitation.' };

  return { data: row, error: null };
}

export async function fetchManagedSpaceInvites(
  spaceId: string,
): Promise<{ data: ManagedSpaceInvite[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('space_invites')
    .select('*')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: formatSupabaseError(error) };
  return { data: data ?? [], error: null };
}

export async function fetchSpaceInvitePreview(
  token: string,
): Promise<{ data: SpaceInvitePreview | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_space_invite', {
    p_token: token,
  });

  if (error) return { data: null, error: formatSupabaseError(error) };
  const row = firstRow(data);
  if (!row) return { data: null, error: 'This invite link is invalid.' };

  return {
    data: {
      inviteId: row.invite_id,
      status: row.status,
      expiresAt: row.expires_at,
      invitedEmailHint: row.invited_email_hint,
      spaceName: row.space_name,
      destination: row.destination,
      startDate: row.start_date,
      endDate: row.end_date,
      invitedByName: row.invited_by_name,
    },
    error: null,
  };
}

export async function acceptSpaceInvite(
  token: string,
): Promise<{ data: InviteAcceptance | null; error: string | null }> {
  const { data, error } = await supabase.rpc('accept_space_invite', {
    p_token: token,
  });

  if (error) return { data: null, error: formatSupabaseError(error) };
  const row = firstRow(data);
  if (!row) return { data: null, error: 'Could not join this trip.' };
  return {
    data: {
      spaceId: row.space_id,
      outcome: row.outcome,
    },
    error: null,
  };
}

export async function revokeSpaceInvite(
  inviteId: string,
): Promise<{ revoked: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc('revoke_space_invite', {
    p_invite_id: inviteId,
  });
  if (error) return { revoked: false, error: formatSupabaseError(error) };
  return { revoked: data, error: null };
}

