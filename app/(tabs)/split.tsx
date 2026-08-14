import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SplitSpaceCard } from '@/components/split/SplitSpaceCard';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';
import { spaceExpensesHref } from '@/lib/expense-routes';
import { fetchSplitSpaceSummaries, type SplitSpaceSummary } from '@/lib/split-hub';

type LoadState = 'loading' | 'success' | 'error';

export default function SplitTabScreen() {
  const [summaries, setSummaries] = useState<SplitSpaceSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState('loading');
    setErrorMessage(null);

    const result = await fetchSplitSpaceSummaries();

    if (result.error || !result.data) {
      setErrorMessage(result.error ?? 'Could not load shared expenses.');
      setLoadState('error');
      return;
    }

    setSummaries(result.data);
    setLoadState('success');
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PEAK</Text>
        <Text style={styles.title}>Split</Text>
        <Text style={styles.subtitle}>Trips & shared expenses</Text>
      </View>

      {loadState === 'loading' && summaries.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PeakColors.primary} />
          <Text style={styles.loadingText}>Loading shared expenses…</Text>
        </View>
      ) : loadState === 'error' && summaries.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={PeakColors.textMuted} />
          <Text style={styles.emptyTitle}>Could not load Split</Text>
          <Text style={styles.emptyMessage}>{errorMessage}</Text>
          <PeakButton title="Try again" onPress={() => void refresh()} style={styles.button} />
        </View>
      ) : summaries.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons name="receipt-outline" size={32} color={PeakColors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Create a Space to start splitting</Text>
          <Text style={styles.emptyMessage}>
            Create or join a Space for a trip, then everyone can add receipts and track shared
            expenses together.
          </Text>
          <PeakButton
            title="Go to Spaces"
            onPress={() => router.navigate('/(tabs)/spaces')}
            style={styles.button}
          />
        </View>
      ) : (
        <FlatList
          data={summaries}
          keyExtractor={(item) => item.space.id}
          renderItem={({ item }) => (
            <SplitSpaceCard
              summary={item}
              onPress={() => router.push(spaceExpensesHref(item.space.id, 'split'))}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loadState === 'loading'}
          onRefresh={() => void refresh()}
          ListFooterComponent={
            errorMessage ? <Text style={styles.inlineError}>{errorMessage}</Text> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  eyebrow: {
    ...Typography.caption,
    color: PeakColors.pink,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h1,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
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
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.primaryLight,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h2,
    textAlign: 'center',
  },
  emptyMessage: {
    ...Typography.bodySmall,
    color: PeakColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginTop: Spacing.sm,
  },
  button: {
    marginTop: Spacing.lg,
  },
  inlineError: {
    ...Typography.caption,
    color: PeakColors.error,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
