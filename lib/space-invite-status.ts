export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export function effectiveInviteStatus(
  invite: { status: InviteStatus; expires_at: string },
  now = Date.now(),
): InviteStatus {
  if (invite.status === 'pending' && new Date(invite.expires_at).getTime() <= now) {
    return 'expired';
  }
  return invite.status;
}

