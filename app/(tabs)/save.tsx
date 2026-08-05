import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { PeakInput } from '@/components/ui/PeakInput';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Space } from '@/types/database';

const initialForm = {
  title: '',
  url: '',
  notes: '',
  spaceId: null as string | null,
};

function formatSupabaseError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  return [error.message, error.details, error.hint, error.code ? `Code: ${error.code}` : null]
    .filter(Boolean)
    .join('\n\n');
}

export default function SaveScreen() {
  const { spaceId: spaceIdParam } = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const preselectedSpaceId = Array.isArray(spaceIdParam) ? spaceIdParam[0] : spaceIdParam;

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(true);

  const [form, setForm] = useState(initialForm);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [spaceError, setSpaceError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [spacePickerVisible, setSpacePickerVisible] = useState(false);

  const fetchSpaces = useCallback(async () => {
    setSpacesLoading(true);

    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) {
      setSpaces(data ?? []);
    }

    setSpacesLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSpaces();
      if (preselectedSpaceId) {
        setForm((prev) => ({ ...prev, spaceId: preselectedSpaceId }));
        setSpaceError(null);
      }
      if (!saving && !saved) {
        setSaveError(null);
      }
    }, [fetchSpaces, preselectedSpaceId, saved, saving]),
  );

  useEffect(() => {
    if (!saved) return;

    const timer = setTimeout(() => {
      setSaved(false);
      router.navigate('/');
    }, 1500);

    return () => clearTimeout(timer);
  }, [saved]);

  const selectedSpace = spaces.find((space) => space.id === form.spaceId);

  const resetForm = () => {
    setForm(initialForm);
    setTitleError(null);
    setSpaceError(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    const trimmedTitle = form.title.trim();
    let hasError = false;

    if (!trimmedTitle) {
      setTitleError('Add a title for this inspiration.');
      hasError = true;
    } else {
      setTitleError(null);
    }

    if (!form.spaceId) {
      setSpaceError('Choose a space to save into.');
      hasError = true;
    } else {
      setSpaceError(null);
    }

    if (hasError) return;

    setSaveError(null);
    setSaving(true);

    try {
      const { error } = await supabase.from('inspiration').insert({
        title: trimmedTitle,
        url: form.url.trim() || null,
        notes: form.notes.trim() || null,
        space_id: form.spaceId!,
      });

      if (error) {
        console.error('Save inspiration insert failed:', error);
        const message = formatSupabaseError(error);
        setSaveError(message);
        Alert.alert('Could not save inspiration', message);
        return;
      }

      resetForm();
      setSaved(true);
    } catch (error) {
      console.error('Save inspiration unexpected error:', error);
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred while saving.';
      setSaveError(message);
      Alert.alert('Could not save inspiration', message);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={PeakColors.success} />
          </View>
          <Text style={styles.successTitle}>Saved!</Text>
          <Text style={styles.successMessage}>Your inspiration is ready on Home.</Text>
          <ActivityIndicator style={styles.successSpinner} color={PeakColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>PEAK</Text>
          <Text style={styles.title}>Save inspiration</Text>
          <Text style={styles.subtitle}>
            Capture a place, link, or idea and tuck it into the right trip space.
          </Text>

          <PeakInput
            autoCapitalize="sentences"
            error={titleError ?? undefined}
            label="Title"
            placeholder="Hidden beach in Mallorca"
            value={form.title}
            onChangeText={(title) => {
              setForm((prev) => ({ ...prev, title }));
              if (titleError) setTitleError(null);
            }}
          />

          <PeakInput
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={styles.fieldGap}
            keyboardType="url"
            label="URL (optional)"
            placeholder="https://..."
            value={form.url}
            onChangeText={(url) => setForm((prev) => ({ ...prev, url }))}
          />

          <PeakInput
            containerStyle={styles.fieldGap}
            label="Notes (optional)"
            multiline
            numberOfLines={4}
            placeholder="Why you want to go, best time to visit..."
            style={styles.notesInput}
            textAlignVertical="top"
            value={form.notes}
            onChangeText={(notes) => setForm((prev) => ({ ...prev, notes }))}
          />

          <View style={styles.fieldGap}>
            <Text style={styles.fieldLabel}>Space</Text>
            <Pressable
              accessibilityRole="button"
              disabled={spacesLoading || spaces.length === 0}
              onPress={() => setSpacePickerVisible(true)}
              style={({ pressed }) => [
                styles.spaceSelect,
                spaceError && styles.spaceSelectError,
                pressed && styles.spaceSelectPressed,
                (spacesLoading || spaces.length === 0) && styles.spaceSelectDisabled,
              ]}>
              {spacesLoading ? (
                <ActivityIndicator size="small" color={PeakColors.primary} />
              ) : selectedSpace ? (
                <>
                  <Text style={styles.spaceSelectEmoji}>{selectedSpace.emoji}</Text>
                  <Text style={styles.spaceSelectText} numberOfLines={1}>
                    {selectedSpace.name}
                  </Text>
                </>
              ) : (
                <Text style={styles.spaceSelectPlaceholder}>
                  {spaces.length === 0 ? 'Create a space first' : 'Select a space'}
                </Text>
              )}
              <Ionicons name="chevron-down" size={20} color={PeakColors.textSecondary} />
            </Pressable>
            {spaceError ? <Text style={styles.fieldError}>{spaceError}</Text> : null}
            {spaces.length === 0 && !spacesLoading ? (
              <PeakButton
                title="Go to Spaces"
                variant="text"
                onPress={() => router.push('/spaces')}
                style={styles.goSpacesButton}
              />
            ) : null}
          </View>

          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

          <PeakButton
            fullWidth
            loading={saving}
            title="Save inspiration"
            onPress={handleSave}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={spacePickerVisible}
        onRequestClose={() => setSpacePickerVisible(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose a space</Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => setSpacePickerVisible(false)}>
              <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            {spaces.map((space) => {
              const selected = form.spaceId === space.id;
              return (
                <Pressable
                  key={space.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setForm((prev) => ({ ...prev, spaceId: space.id }));
                    setSpaceError(null);
                    setSpacePickerVisible(false);
                  }}
                  style={({ pressed }) => [
                    styles.spaceOption,
                    selected && styles.spaceOptionSelected,
                    pressed && styles.spaceOptionPressed,
                  ]}>
                  <Text style={styles.spaceOptionEmoji}>{space.emoji}</Text>
                  <View style={styles.spaceOptionText}>
                    <Text style={styles.spaceOptionName}>{space.name}</Text>
                    {space.destination ? (
                      <Text style={styles.spaceOptionDestination} numberOfLines={1}>
                        {space.destination}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={PeakColors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
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
    marginBottom: Spacing.lg,
  },
  fieldGap: {
    marginTop: Spacing.md,
  },
  fieldLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  notesInput: {
    minHeight: 100,
    paddingTop: Spacing.sm,
  },
  spaceSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
    gap: Spacing.sm,
  },
  spaceSelectError: {
    borderColor: PeakColors.error,
    backgroundColor: PeakColors.errorLight,
  },
  spaceSelectPressed: {
    opacity: 0.9,
  },
  spaceSelectDisabled: {
    opacity: 0.7,
  },
  spaceSelectEmoji: {
    fontSize: 22,
  },
  spaceSelectText: {
    ...Typography.body,
    flex: 1,
  },
  spaceSelectPlaceholder: {
    ...Typography.body,
    flex: 1,
    color: PeakColors.textMuted,
  },
  fieldError: {
    ...Typography.caption,
    color: PeakColors.error,
    marginTop: Spacing.xs,
  },
  goSpacesButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  saveError: {
    ...Typography.caption,
    color: PeakColors.error,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: Spacing.xl,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  successIconWrap: {
    marginBottom: Spacing.md,
  },
  successTitle: {
    ...Typography.h1,
    color: PeakColors.success,
  },
  successMessage: {
    ...Typography.bodySmall,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  successSpinner: {
    marginTop: Spacing.lg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: PeakColors.background,
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
  modalList: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  spaceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
    gap: Spacing.md,
  },
  spaceOptionSelected: {
    borderColor: PeakColors.primary,
    backgroundColor: PeakColors.primaryLight,
  },
  spaceOptionPressed: {
    opacity: 0.92,
  },
  spaceOptionEmoji: {
    fontSize: 28,
  },
  spaceOptionText: {
    flex: 1,
  },
  spaceOptionName: {
    ...Typography.label,
  },
  spaceOptionDestination: {
    ...Typography.caption,
    marginTop: 2,
  },
});
