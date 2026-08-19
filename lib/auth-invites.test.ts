import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  passwordResetCallbackParams,
  safeAuthDestination,
  safeInviteToken,
} from './auth-navigation';
import { homeHeaderIdentity } from './home-header-identity';
import { effectiveInviteStatus } from './space-invite-status';

const TOKEN = 'a'.repeat(64);

describe('auth invite navigation', () => {
  it('preserves only valid internal invite destinations', () => {
    assert.equal(safeAuthDestination(`/invite/${TOKEN}`), `/invite/${TOKEN}`);
    assert.equal(safeAuthDestination('https://evil.example/invite'), '/');
    assert.equal(safeAuthDestination('/spaces/private-space'), '/');
    assert.equal(safeAuthDestination(undefined), '/');
  });

  it('accepts only 256-bit hexadecimal invite tokens', () => {
    assert.equal(safeInviteToken(TOKEN), TOKEN);
    assert.equal(safeInviteToken('short-token'), null);
    assert.equal(safeInviteToken(`${'z'.repeat(64)}`), null);
  });

  it('preserves a safe destination through password recovery', () => {
    assert.deepEqual(passwordResetCallbackParams(`/invite/${TOKEN}`), {
      next: '/reset-password',
      returnTo: `/invite/${TOKEN}`,
    });
  });
});

describe('invite lifecycle display', () => {
  it('treats elapsed pending invites as expired without changing final states', () => {
    assert.equal(
      effectiveInviteStatus(
        { status: 'pending', expires_at: '2026-01-01T00:00:00.000Z' },
        Date.parse('2026-01-02T00:00:00.000Z'),
      ),
      'expired',
    );
    assert.equal(
      effectiveInviteStatus(
        { status: 'accepted', expires_at: '2026-01-01T00:00:00.000Z' },
        Date.parse('2026-01-02T00:00:00.000Z'),
      ),
      'accepted',
    );
  });
});

describe('home header identity', () => {
  const userA = {
    id: 'user-a',
    firstName: 'Ty',
    lastName: 'Henderson',
    displayName: 'Ty Henderson',
  };
  const userB = {
    id: 'user-b',
    firstName: 'Sam',
    lastName: 'Lee',
    displayName: 'Sam Lee',
  };

  it('never renders another user while loading or when profile ids do not match', () => {
    assert.deepEqual(homeHeaderIdentity('user-b', userA, 'success'), {
      greeting: 'Good evening',
      greetingName: null,
      initials: null,
      ready: false,
    });
    assert.deepEqual(homeHeaderIdentity('user-b', userB, 'loading'), {
      greeting: 'Good evening',
      greetingName: null,
      initials: null,
      ready: false,
    });
  });

  it('renders only the current authenticated user after a successful profile load', () => {
    assert.deepEqual(homeHeaderIdentity('user-b', userB, 'success'), {
      greeting: 'Good evening, Sam',
      greetingName: 'Sam',
      initials: 'SL',
      ready: true,
    });
    assert.deepEqual(homeHeaderIdentity('user-a', userA, 'success'), {
      greeting: 'Good evening, Ty',
      greetingName: 'Ty',
      initials: 'TH',
      ready: true,
    });
  });
});

