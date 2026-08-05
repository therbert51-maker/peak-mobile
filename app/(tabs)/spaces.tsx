import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakCard } from '@/components/ui/PeakCard';
import { PeakInput } from '@/components/ui/PeakInput';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { colorBackground, SPACE_COLOR_OPTIONS } from '@/lib/space-colors';
import { supabase } from '@/lib/supabase';
import type { Space } from '@/types/database';

const DEFAULT_EMOJI = '✈️';

type SpaceColorValue = (typeof SPACE_COLOR_OPTIONS)[number]['value'];

type NewSpaceForm = {
  name: string;
  destination: string;
  emoji: string;
  color: SpaceColorValue;
};

type LoadState = 'loading' | 'success' | 'error';

const initialForm: NewSpaceForm = {
  name: '',
  destination: '',
  emoji: DEFAULT_EMOJI,
  color: SPACE_COLOR_OPTIONS[0].value,
};

export default function SpacesScreen() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<NewSpaceForm>(initialForm);
  const [nameError, setNameError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSpaces = useCallback(async () => {
    setLoadState('loading');
    setFetchError(null);

    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setFetchError(error.message || 'Could not load spaces. Check your connection and try again.');
      setLoadState('error');
      return;
    }

    setSpaces(data ?? []);
    setLoadState('success');
  }, []);

  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  const openModal = () => {
    setForm(initialForm);
    setNameError(null);
    setCreateError(null);
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setForm(initialForm);
    setNameError(null);
    setCreateError(null);
  };

  const handleCreate = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setNameError('Give your space a name to continue.');
      return;
    }

    setNameError(null);
    setCreateError(null);
    setSaving(true);

    const payload = {
      name: trimmedName,
      emoji: form.emoji.trim() || DEFAULT_EMOJI,
      destination: form.destination.trim() || null,
      color: form.color,
    };

    const { data, error } = await supabase.from('spaces').insert(payload).select().single();

    setSaving(false);

    if (error) {
      setCreateError(error.message || 'Something went wrong while creating your space.');
      return;
    }

    if (data) {
      setSpaces((current) => [data, ...current]);
    } else {
      await fetchSpaces();
    }

    setModalVisible(false);
    setForm(initialForm);
    setLoadState('success');
  };

  const renderSpaceCard = ({ item }: { item: Space }) => (
    <PeakCard
      onPress={() => router.push(`/spaces/${item.id}`)}
      style={[styles.spaceCard, { backgroundColor: colorBackground(item.color) }]}
      padding="md">
      <Text style={styles.spaceEmoji}>{item.emoji}</Text>
      <Text style={styles.spaceName} numberOfLines={2}>
        {item.name}
      </Text>
      {item.destination ? (
        <View style={styles.destinationRow}>
          <Ionicons name="location-outline" size={14} color={PeakColors.textSecondary} />
          <Text style={styles.spaceDestination} numberOfLines={1}>
            {item.destination}
          </Text>
        </View>
      ) : (
        <Text style={styles.spaceDestinationMuted}>No destination yet</Text>
      )}
    </PeakCard>
  );

  const listHeader = (
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>PEAK</Text>
        <Text style={styles.title}>Your spaces</Text>
        <Text style={styles.subtitle}>Trips and collections for the places you love.</Text>
      </View>
      <PeakButton title="New Space" onPress={openModal} style={styles.newButton} />
    </View>
  );

  const renderBody = () => {
    if (loadState === 'loading' && spaces.length === 0) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PeakColors.primary} />
          <Text style={styles.loadingText}>Loading your spaces…</Text>
        </View>
      );
    }

    if (loadState === 'error' && spaces.length === 0) {
      return (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={PeakColors.textMuted} />
          <Text style={styles.errorTitle}>Could not load spaces</Text>
          <Text style={styles.errorMessage}>{fetchError}</Text>
          <PeakButton title="Try again" onPress={fetchSpaces} style={styles.retryButton} />
        </View>
      );
    }

    if (loadState === 'success' && spaces.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🗺️</Text>
          <Text style={styles.emptyTitle}>No spaces yet</Text>
          <Text style={styles.emptyMessage}>
            Create a space for your next trip and start saving restaurants, stays, and hidden gems.
          </Text>
          <PeakButton title="Create your first space" onPress={openModal} style={styles.retryButton} />
        </View>
      );
    }

    return (
      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        renderItem={renderSpaceCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={loadState === 'loading'}
        onRefresh={fetchSpaces}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {listHeader}
      {renderBody()}

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={modalVisible}
        onRequestClose={closeModal}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalFlex}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New space</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                disabled={saving}
                hitSlop={12}
                onPress={closeModal}
                style={({ pressed }) => pressed && styles.modalClosePressed}>
                <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <PeakInput
                autoCapitalize="words"
                autoCorrect={false}
                error={nameError ?? undefined}
                label="Space name"
                placeholder="Spain 2026"
                value={form.name}
                onChangeText={(name) => {
                  setForm((prev) => ({ ...prev, name }));
                  if (nameError) setNameError(null);
                }}
              />

              <PeakInput
                autoCapitalize="words"
                containerStyle={styles.fieldGap}
                label="Destination (optional)"
                placeholder="Barcelona, Spain"
                value={form.destination}
                onChangeText={(destination) => setForm((prev) => ({ ...prev, destination }))}
              />

              <View style={styles.fieldGap}>
                <Text style={styles.fieldLabel}>Emoji</Text>
                <PeakInput
                  placeholder={DEFAULT_EMOJI}
                  style={styles.emojiInput}
                  value={form.emoji}
                  onChangeText={(emoji) => setForm((prev) => ({ ...prev, emoji }))}
                />
              </View>

              <View style={styles.fieldGap}>
                <Text style={styles.fieldLabel}>Color</Text>
                <View style={styles.colorRow}>
                  {SPACE_COLOR_OPTIONS.map((option) => {
                    const selected = form.color === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setForm((prev) => ({ ...prev, color: option.value }))}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: option.background, borderColor: option.value },
                          selected && styles.colorSwatchSelected,
                        ]}>
                        {selected ? (
                          <Ionicons name="checkmark" size={20} color={option.value} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {createError ? <Text style={styles.createError}>{createError}</Text> : null}

              <PeakButton
                fullWidth
                loading={saving}
                title="Create space"
                onPress={handleCreate}
                style={styles.createButton}
              />
              <PeakButton
                disabled={saving}
                fullWidth
                title="Cancel"
                variant="text"
                onPress={closeModal}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
    paddingBottom: Spacing.md,
    gap: Spacing.md,
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
  newButton: {
    alignSelf: 'flex-start',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  spaceCard: {
    marginBottom: Spacing.md,
    minHeight: 120,
    borderWidth: 0,
  },
  spaceEmoji: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  spaceName: {
    ...Typography.h3,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  spaceDestination: {
    ...Typography.bodySmall,
    flex: 1,
  },
  spaceDestinationMuted: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
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
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...Typography.h2,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptyMessage: {
    ...Typography.bodySmall,
    marginTop: Spacing.sm,
    textAlign: 'center',
    maxWidth: 300,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  modalFlex: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PeakColors.border,
  },
  modalTitle: {
    ...Typography.h2,
  },
  modalClosePressed: {
    opacity: 0.6,
  },
  modalScroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  fieldGap: {
    marginTop: Spacing.md,
  },
  fieldLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  emojiInput: {
    textAlign: 'center',
    fontSize: 28,
  },
  colorRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  colorSwatch: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.medium,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
  },
  createError: {
    ...Typography.caption,
    color: PeakColors.error,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  createButton: {
    marginTop: Spacing.xl,
  },
});
