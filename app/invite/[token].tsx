import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakCard } from '@/components/ui/PeakCard';
import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { safeInviteToken } from '@/lib/auth-navigation';
import { resetToJoinedSpace } from '@/lib/auth-app-navigation';
import {
  acceptSpaceInvite,
  fetchSpaceInvitePreview,
  type SpaceInvitePreview,
} from '@/lib/space-invites';
import { formatTripDateRange } from '@/lib/trip-dates';

type LoadState = 'loading' | 'ready' | 'error';

export default function InviteScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = safeInviteToken(tokenParam);
  const next = token ? (`/invite/${token}` as const) : '/';
  const { session, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<SpaceInvitePreview | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinedSpaceId, setJoinedSpaceId] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

  const loadInvite = useCallback(async () => {
    if (!token) {
      setLoadState('error');
      setErrorMessage('This invite link is invalid.');
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);
    const result = await fetchSpaceInvitePreview(token);
    if (result.error || !result.data) {
      setLoadState('error');
      setErrorMessage(result.error ?? 'This invite could not be loaded.');
      return;
    }

    setPreview(result.data);
    setLoadState('ready');
  }, [token]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const handleJoin = async () => {
    if (!token) return;
    setJoining(true);
    setErrorMessage(null);
    const result = await acceptSpaceInvite(token);
    setJoining(false);

    if (result.error || !result.data) {
      setErrorMessage(result.error ?? 'Could not join this trip.');
      return;
    }

    setJoinedSpaceId(result.data.spaceId);
    setAlreadyMember(result.data.outcome === 'already_member');
    resetToJoinedSpace(result.data.spaceId);
  };

  const inviteUnavailable =
    preview?.status === 'revoked' ||
    preview?.status === 'expired';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => {
            if (session) {
              router.dismissTo('/(tabs)' as Href);
              return;
            }
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/sign-in');
          }}>
          <Ionicons name="close" size={26} color={PeakColors.textPrimary} />
        </Pressable>
        <Text style={styles.eyebrow}>PEAK INVITE</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loadState === 'loading' || authLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PeakColors.primary} />
            <Text style={styles.supporting}>Loading your invitation…</Text>
          </View>
        ) : loadState === 'error' || !preview ? (
          <View style={styles.centered}>
            <Ionicons name="link-outline" size={48} color={PeakColors.textMuted} />
            <Text style={styles.title}>Invite unavailable</Text>
            <Text style={styles.supporting}>{errorMessage}</Text>
            <PeakButton title="Try again" variant="outline" onPress={loadInvite} />
          </View>
        ) : (
          <>
            <View style={styles.heroIcon}>
              <Ionicons name="paper-plane-outline" size={36} color={PeakColors.primary} />
            </View>
            <Text style={styles.title}>
              {alreadyMember ? 'You’re already on this trip' : `Join ${preview.spaceName}`}
            </Text>
            <Text style={styles.supporting}>
              {preview.invitedByName} invited {preview.invitedEmailHint} to travel together on Peak.
            </Text>

            <PeakCard padding="md" style={styles.tripCard}>
              <Text style={styles.tripName}>{preview.spaceName}</Text>
              {preview.destination ? (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={18} color={PeakColors.primary} />
                  <Text style={styles.detailText}>{preview.destination}</Text>
                </View>
              ) : null}
              {preview.startDate || preview.endDate ? (
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color={PeakColors.primary} />
                  <Text style={styles.detailText}>
                    {formatTripDateRange(preview.startDate, preview.endDate)}
                  </Text>
                </View>
              ) : null}
            </PeakCard>

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            {joinedSpaceId ? (
              <PeakButton
                fullWidth
                title="Open Trip"
                onPress={() => resetToJoinedSpace(joinedSpaceId)}
                style={styles.primaryAction}
              />
            ) : inviteUnavailable ? (
              <View style={styles.unavailable}>
                <Ionicons name="information-circle-outline" size={22} color={PeakColors.textSecondary} />
                <Text style={styles.unavailableText}>
                  {preview.status === 'expired'
                    ? 'This invitation has expired.'
                    : 'This invitation was revoked.'}
                </Text>
              </View>
            ) : !session ? (
              <View style={styles.actions}>
                <PeakButton
                  fullWidth
                  title="Log In to Join"
                  onPress={() =>
                    router.push({
                      pathname: '/sign-in',
                      params: { next },
                    })
                  }
                />
                <PeakButton
                  fullWidth
                  title="Create Account"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/sign-up',
                      params: { next },
                    })
                  }
                />
              </View>
            ) : (
              <PeakButton
                fullWidth
                loading={joining}
                title={preview.status === 'accepted' ? 'Open Joined Trip' : 'Join Trip'}
                onPress={handleJoin}
                style={styles.primaryAction}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  topBar: {
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarSpacer: {
    width: 26,
  },
  eyebrow: {
    ...Typography.caption,
    color: PeakColors.pink,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  centered: {
    flex: 1,
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  heroIcon: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.pill,
    backgroundColor: PeakColors.primaryLight,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: PeakColors.navy,
    textAlign: 'center',
  },
  supporting: {
    ...Typography.body,
    color: PeakColors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    maxWidth: 340,
  },
  tripCard: {
    alignSelf: 'stretch',
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  tripName: {
    ...Typography.h2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailText: {
    ...Typography.bodySmall,
    color: PeakColors.textSecondary,
    flex: 1,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  primaryAction: {
    alignSelf: 'stretch',
    marginTop: Spacing.xl,
  },
  error: {
    ...Typography.bodySmall,
    color: PeakColors.error,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  unavailable: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.surfaceMuted,
    marginTop: Spacing.xl,
  },
  unavailableText: {
    ...Typography.bodySmall,
    color: PeakColors.textSecondary,
    flex: 1,
  },
});

