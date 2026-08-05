import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useInspirationRefresh } from '@/hooks/use-inspiration-refresh';
import { colorBackground } from '@/lib/space-colors';
import { warnSpacesWithNullOwner } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';
import type { Inspiration, Space } from '@/types/database';

type LoadState = 'loading' | 'success' | 'error';

export default function SpaceDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = Array.isArray(id) ? id[0] : id;

  const [space, setSpace] = useState<Space | null>(null);
  const [inspiration, setInspiration] = useState<Inspiration[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSpaceDetails = useCallback(async () => {
    if (!spaceId) {
      setErrorMessage('This space could not be found.');
      setLoadState('error');
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    const [spaceResult, inspirationResult] = await Promise.all([
      supabase.from('spaces').select('*').eq('id', spaceId).single(),
      supabase
        .from('inspiration')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false }),
    ]);

    if (spaceResult.error) {
      setErrorMessage(spaceResult.error.message || 'Could not load this space.');
      setSpace(null);
      setInspiration([]);
      setLoadState('error');
      return;
    }

    if (inspirationResult.error) {
      setErrorMessage(inspirationResult.error.message || 'Could not load inspiration for this space.');
      setSpace(spaceResult.data);
      setInspiration([]);
      setLoadState('error');
      return;
    }

    setSpace(spaceResult.data);
    setInspiration(inspirationResult.data ?? []);
    if (spaceResult.data) {
      warnSpacesWithNullOwner([spaceResult.data]);
    }
    setLoadState('success');
  }, [spaceId]);

  useInspirationRefresh(fetchSpaceDetails, { spaceId: spaceId ?? null });

  const openSaveWithSpace = () => {
    if (!spaceId) return;
    router.push({
      pathname: '/save',
      params: { spaceId },
    });
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={PeakColors.textPrimary} />
          </Pressable>
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
