import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  buildTripUpdatePayload,
  EditTripModal,
  tripFormFromSpace,
  type TripEditForm,
} from '@/components/spaces/EditTripModal';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakCard } from '@/components/ui/PeakCard';
import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useInspirationRefresh } from '@/hooks/use-inspiration-refresh';
import { colorBackground } from '@/lib/space-colors';
import { formatSupabaseError, warnSpacesWithNullOwner } from '@/lib/spaces';
import { formatTripDateRange } from '@/lib/trip-dates';
import { supabase } from '@/lib/supabase';
import type { Inspiration, Profile, Space, SpaceMember } from '@/types/database';

type LoadState = 'loading' | 'success' | 'error';

type MemberPreview = SpaceMember & {
  profiles: Pick<Profile, 'id' | 'email' | 'full_name' | 'avatar_url'> | null;
};

type OwnerPreview = Pick<Profile, 'id' | 'email' | 'full_name' | 'avatar_url'> | null;

function memberDisplayName(profile: OwnerPreview): string {
  if (!profile) return 'Member';
  return profile.full_name?.trim() || profile.email?.trim() || 'Member';
}

function memberInitials(profile: OwnerPreview): string {
  const name = memberDisplayName(profile);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function TripDetailRow({
  icon,
  label,
  value,
  emptyLabel,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string | null;
  emptyLabel: string;
}) {
  const hasValue = Boolean(value?.trim());
  return (
    <View style={styles.tripRow}>
      <View style={styles.tripIconWrap}>
        <Ionicons name={icon} size={20} color={PeakColors.primary} />
      </View>
      <View style={styles.tripRowText}>
        <Text style={styles.tripRowLabel}>{label}</Text>
        <Text style={[styles.tripRowValue, !hasValue && styles.tripRowEmpty]}>
          {hasValue ? value : emptyLabel}
        </Text>
      </View>
    </View>
  );
}

export default function SpaceDetailsScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = Array.isArray(id) ? id[0] : id;

  const [space, setSpace] = useState<Space | null>(null);
  const [inspiration, setInspiration] = useState<Inspiration[]>([]);
  const [members, setMembers] = useState<MemberPreview[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<OwnerPreview>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [editTripVisible, setEditTripVisible] = useState(false);
  const [tripForm, setTripForm] = useState<TripEditForm>({
    description: '',
    startDate: '',
    endDate: '',
    airport: '',
    lodging: '',
  });
  const [tripSaveError, setTripSaveError] = useState<string | null>(null);
  const [tripSaving, setTripSaving] = useState(false);

  const isOwner = Boolean(user?.id && space?.owner_id && user.id === space.owner_id);

  const fetchSpaceDetails = useCallback(async () => {
    if (!spaceId) {
      setErrorMessage('This space could not be found.');
      setLoadState('error');
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    const [spaceResult, inspirationResult, membersResult] = await Promise.all([
      supabase.from('spaces').select('*').eq('id', spaceId).single(),
      supabase
        .from('inspiration')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false }),
      supabase
        .from('space_members')
        .select('*, profiles ( id, email, full_name, avatar_url )')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: true }),
    ]);

    if (spaceResult.error) {
      setErrorMessage(spaceResult.error.message || 'Could not load this space.');
      setSpace(null);
      setInspiration([]);
      setMembers([]);
      setOwnerProfile(null);
      setLoadState('error');
      return;
    }

    if (inspirationResult.error) {
      setErrorMessage(inspirationResult.error.message || 'Could not load inspiration for this space.');
      setSpace(spaceResult.data);
      setInspiration([]);
      setMembers((membersResult.data as MemberPreview[] | null) ?? []);
      setLoadState('error');
    } else {
      setSpace(spaceResult.data);
      setInspiration(inspirationResult.data ?? []);
      setMembers((membersResult.data as MemberPreview[] | null) ?? []);
      setLoadState('success');
    }

    const ownerId = spaceResult.data?.owner_id;
    if (ownerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .eq('id', ownerId)
        .maybeSingle();
      setOwnerProfile(profile);
    } else {
      setOwnerProfile(null);
    }

    if (spaceResult.data) {
      warnSpacesWithNullOwner([spaceResult.data]);
      setTripForm(tripFormFromSpace(spaceResult.data));
    }
  }, [spaceId]);

  useInspirationRefresh(fetchSpaceDetails, { spaceId: spaceId ?? null });

  const openSaveWithSpace = () => {
    if (!spaceId) return;
    router.push({
      pathname: '/save',
      params: { spaceId },
    });
  };

  const openEditTrip = () => {
    if (!space) return;
    setTripForm(tripFormFromSpace(space));
    setTripSaveError(null);
    setEditTripVisible(true);
  };

  const closeEditTrip = () => {
    if (tripSaving) return;
    setEditTripVisible(false);
    setTripSaveError(null);
    if (space) {
      setTripForm(tripFormFromSpace(space));
    }
  };

  const handleSaveTrip = async () => {
    if (!spaceId || !space) return;

    const { payload, error: validationError } = buildTripUpdatePayload(tripForm);
    if (validationError || !payload) {
      setTripSaveError(validationError ?? 'Could not validate trip details.');
      return;
    }

    setTripSaveError(null);
    setTripSaving(true);

    const { data, error } = await supabase
      .from('spaces')
      .update(payload)
      .eq('id', spaceId)
      .select()
      .single();

    setTripSaving(false);

    if (error || !data) {
      setTripSaveError(error ? formatSupabaseError(error) : 'Could not save trip details.');
      return;
    }

    setSpace(data);
    setTripForm(tripFormFromSpace(data));
    setEditTripVisible(false);
  };

  const showInvitePlaceholder = () => {
    Alert.alert('Invites coming soon', 'You will be able to invite friends to this trip in a future update.');
  };

  if (loadState === 'loading' && !space) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PeakColors.primary} />
          <Text style={styles.loadingText}>Loading space…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === 'error' && !space) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={PeakColors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={PeakColors.textMuted} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <PeakButton title="Try again" onPress={fetchSpaceDetails} style={styles.retryButton} />
        </View>
      </SafeAreaView>
    );
  }

  if (!space) {
    return null;
  }

  const heroBackground = colorBackground(space.color);
  const dateRange = formatTripDateRange(space.start_date, space.end_date);
  const otherMembers = members.filter(
    (member) => member.user_id !== space.owner_id && member.role !== 'owner',
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={PeakColors.textPrimary} />
          </Pressable>
          {isOwner ? (
            <Pressable accessibilityRole="button" hitSlop={12} onPress={openEditTrip}>
              <Text style={styles.editTripLink}>Edit trip</Text>
            </Pressable>
          ) : (
            <View style={styles.topBarSpacer} />
          )}
        </View>

        <View style={[styles.hero, { backgroundColor: heroBackground }]}>
          <View style={[styles.colorDot, { backgroundColor: space.color }]} />
          <Text style={styles.heroEmoji}>{space.emoji}</Text>
          <Text style={styles.heroName}>{space.name}</Text>
          {space.destination ? (
            <View style={styles.destinationRow}>
              <Ionicons name="location-outline" size={16} color={PeakColors.textSecondary} />
              <Text style={styles.heroDestination}>{space.destination}</Text>
            </View>
          ) : (
            <Text style={styles.heroDestinationMuted}>No destination set</Text>
          )}
        </View>

        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Trip details</Text>
        </View>

        <PeakCard style={styles.blockCard} padding="md">
          {space.description?.trim() ? (
            <Text style={styles.descriptionBody}>{space.description.trim()}</Text>
          ) : (
            <Text style={styles.emptyInline}>No trip description yet.</Text>
          )}

          <View style={styles.tripDivider} />

          <TripDetailRow
            emptyLabel="Dates not set"
            icon="calendar-outline"
            label="Dates"
            value={dateRange}
          />
          <TripDetailRow
            emptyLabel="Airport not added"
            icon="airplane-outline"
            label="Airport / flights"
            value={space.airport}
          />
          <TripDetailRow
            emptyLabel="Lodging not added"
            icon="bed-outline"
            label="Lodging"
            value={space.lodging}
          />
        </PeakCard>

        <View style={styles.blockHeader}>
          <Text style={styles.blockTitle}>Members</Text>
        </View>

        <PeakCard style={styles.blockCard} padding="md">
          <View style={styles.memberRow}>
            <View style={[styles.memberAvatar, styles.memberAvatarOwner]}>
              <Text style={styles.memberAvatarText}>{memberInitials(ownerProfile)}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{memberDisplayName(ownerProfile)}</Text>
              <Text style={styles.memberRole}>Owner</Text>
            </View>
          </View>

          {otherMembers.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{memberInitials(member.profiles)}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{memberDisplayName(member.profiles)}</Text>
                <Text style={styles.memberRole}>{member.role}</Text>
              </View>
            </View>
          ))}

          {members.length === 0 && !ownerProfile ? (
            <Text style={styles.emptyInline}>No members listed yet.</Text>
          ) : null}

          <PeakButton
            title="Invite people"
            variant="secondary"
            onPress={showInvitePlaceholder}
            style={styles.inviteButton}
          />
        </PeakCard>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inspiration</Text>
          <PeakButton title="Save inspiration" onPress={openSaveWithSpace} />
        </View>

        {loadState === 'error' ? (
          <View style={styles.inlineError}>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <PeakButton title="Retry" variant="outline" onPress={fetchSpaceDetails} />
          </View>
        ) : null}

        {loadState !== 'loading' && inspiration.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyTitle}>No inspiration yet</Text>
            <Text style={styles.emptyMessage}>
              Save restaurants, links, and ideas to build this trip.
            </Text>
            <PeakButton title="Save inspiration" onPress={openSaveWithSpace} style={styles.retryButton} />
          </View>
        ) : (
          <View style={styles.inspirationList}>
            {inspiration.map((item) => (
              <PeakCard
                key={item.id}
                onPress={() => router.push(`/inspiration/${item.id}`)}
                padding="md"
                style={styles.inspirationCard}>
                <Text style={styles.inspirationTitle}>{item.title}</Text>
                {item.notes ? (
                  <Text style={styles.inspirationNotes} numberOfLines={2}>
                    {item.notes}
                  </Text>
                ) : null}
                {item.url ? (
                  <Text style={styles.inspirationUrl} numberOfLines={1}>
                    {item.url}
                  </Text>
                ) : null}
              </PeakCard>
            ))}
          </View>
        )}
      </ScrollView>

      <EditTripModal
        form={tripForm}
        saveError={tripSaveError}
        saving={tripSaving}
        visible={editTripVisible}
        onChange={(patch) => setTripForm((prev) => ({ ...prev, ...patch }))}
        onClose={closeEditTrip}
        onSave={handleSaveTrip}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarSpacer: {
    width: 64,
  },
  editTripLink: {
    ...Typography.label,
    color: PeakColors.primary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    ...Typography.bodySmall,
    marginTop: Spacing.md,
  },
  errorTitle: {
    ...Typography.h3,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  errorMessage: {
    ...Typography.bodySmall,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.lg,
  },
  hero: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: BorderRadius.pill,
    marginBottom: Spacing.sm,
  },
  heroEmoji: {
    fontSize: 44,
    marginBottom: Spacing.sm,
  },
  heroName: {
    ...Typography.h1,
    fontSize: 26,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  heroDestination: {
    ...Typography.bodySmall,
    flex: 1,
  },
  heroDestinationMuted: {
    ...Typography.caption,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  blockHeader: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  blockTitle: {
    ...Typography.h2,
  },
  blockCard: {
    marginHorizontal: Spacing.lg,
  },
  descriptionBody: {
    ...Typography.body,
  },
  emptyInline: {
    ...Typography.bodySmall,
    fontStyle: 'italic',
    color: PeakColors.textSecondary,
  },
  tripDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PeakColors.border,
    marginVertical: Spacing.md,
  },
  tripRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  tripIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripRowText: {
    flex: 1,
  },
  tripRowLabel: {
    ...Typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tripRowValue: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  tripRowEmpty: {
    fontStyle: 'italic',
    color: PeakColors.textMuted,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.pill,
    backgroundColor: PeakColors.aquaLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarOwner: {
    backgroundColor: PeakColors.primaryLight,
  },
  memberAvatarText: {
    ...Typography.caption,
    fontWeight: '800',
    color: PeakColors.navy,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...Typography.label,
  },
  memberRole: {
    ...Typography.caption,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  inviteButton: {
    marginTop: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h2,
    flex: 1,
  },
  inlineError: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.errorLight,
    gap: Spacing.sm,
  },
  emptyState: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.large,
    backgroundColor: PeakColors.surface,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.sm,
  },
  emptyMessage: {
    ...Typography.bodySmall,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  inspirationList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  inspirationCard: {
    marginBottom: Spacing.sm,
  },
  inspirationTitle: {
    ...Typography.h3,
  },
  inspirationNotes: {
    ...Typography.bodySmall,
    marginTop: Spacing.xs,
  },
  inspirationUrl: {
    ...Typography.caption,
    color: PeakColors.primary,
    marginTop: Spacing.sm,
  },
});
