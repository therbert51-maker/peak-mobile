const INVITE_ROUTE_PATTERN = /^\/invite\/([A-Fa-f0-9]{64})$/;

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function safeAuthDestination(
  value: string | string[] | undefined,
): '/' | `/invite/${string}` {
  const candidate = firstParam(value)?.trim();
  if (candidate && INVITE_ROUTE_PATTERN.test(candidate)) {
    return candidate as `/invite/${string}`;
  }
  return '/';
}

export function safeInviteToken(value: string | string[] | undefined): string | null {
  const token = firstParam(value)?.trim() ?? '';
  return /^[A-Fa-f0-9]{64}$/.test(token) ? token : null;
}

export function passwordResetCallbackParams(next: string | string[] | undefined): {
  next: '/reset-password';
  returnTo: '/' | `/invite/${string}`;
} {
  return {
    next: '/reset-password',
    returnTo: safeAuthDestination(next),
  };
}

