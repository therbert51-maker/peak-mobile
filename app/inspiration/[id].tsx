import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InspirationPreviewMedia } from '@/components/inspiration/InspirationPreviewMedia';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakCard } from '@/components/ui/PeakCard';
import { PeakInput } from '@/components/ui/PeakInput';
import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { isInstagramPreviewSource } from '@/lib/inspiration-preview-caption';
import { requestInspirationPreviewNonBlocking } from '@/lib/inspiration-preview-api';
import { notifyInspirationSaved } from '@/lib/inspiration-refresh';
import { formatSupabaseError } from '@/lib/spaces';
import { supabase } from '@/lib/supabase';
import type { Inspiration, Space } from '@/types/database';

type InspirationDetail = Inspiration & {
  spaces: Pick<Space, 'id' | 'emoji' | 'name' | 'destination'> | null;
};

type LoadState = 'loading' | 'success' | 'error';

function formatCreatedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function InspirationDetailsScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const inspirationId = Array.isArray(id) ? id[0] : id;

  const [record, setRecord] = useState<InspirationDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isCreator = Boolean(user?.id && record?.created_by && user.id === record.created_by);

  const fetchInspiration = useCallback(async () => {
    if (!inspirationId) {
      setErrorMessage('This inspiration could not be found.');
      setLoadState('error');
      return;
    }

    setLoadState('loading');
    setErrorMessage(null);

    const { data, error } = await supabase
      .from('inspiration')
      .select('*, spaces ( id, emoji, name, destination )')
      .eq('id', inspirationId)
      .single();

    if (error || !data) {
      setErrorMessage(error?.message || 'Could not load this inspiration.');
      setRecord(null);
      setLoadState('error');
      return;
    }

    const detail = data as InspirationDetail;
    setRecord(detail);
    setEditTitle(detail.title);
    setEditNotes(detail.notes ?? '');
    setEditUrl(detail.url ?? '');
    setLoadState('success');
  }, [inspirationId]);

  useEffect(() => {
    fetchInspiration();
  }, [fetchInspiration]);

  const openUrl = async (url: string) => {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const canOpen = await Linking.canOpenURL(normalized);
    if (canOpen) {
      await Linking.openURL(normalized);
    }
  };

  const startEditing = () => {
    if (!record) return;
    setEditTitle(record.title);
    setEditNotes(record.notes ?? '');
    setEditUrl(record.url ?? '');
    setTitleError(null);
    setActionError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (!record) return;
    setEditTitle(record.title);
    setEditNotes(record.notes ?? '');
    setEditUrl(record.url ?? '');
    setTitleError(null);
    setActionError(null);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!record || !inspirationId) return;

    const trimmedTitle = editTitle.trim();
    const trimmedUrl = editUrl.trim();
    const urlChanged = (record.url ?? '').trim() !== trimmedUrl;
    if (!trimmedTitle) {
      setTitleError('Title is required.');
      return;
    }

    setTitleError(null);
    setActionError(null);
    setSaving(true);

    const { data, error } = await supabase
      .from('inspiration')
      .update({
        title: trimmedTitle,
        notes: editNotes.trim() || null,
        url: trimmedUrl || null,
      })
      .eq('id', inspirationId)
      .select('*, spaces ( id, emoji, name, destination )')
      .single();

    setSaving(false);

    if (error || !data) {
      setActionError(
        error ? formatSupabaseError(error) : 'Could not update this inspiration.',
      );
      return;
    }

    const updated = data as InspirationDetail;
    setRecord(updated);
    setIsEditing(false);
    notifyInspirationSaved(updated.space_id);
    if (urlChanged && updated.url) {
      requestInspirationPreviewNonBlocking({
        inspirationId: updated.id,
        spaceId: updated.space_id,
        url: updated.url,
      });
    }
  };

  const handleDelete = () => {
    if (!record || !inspirationId) return;

    Alert.alert(
      'Delete inspiration?',
      'This will permanently remove this save. You cannot undo this action.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setActionError(null);

            const spaceId = record.space_id;
            const { error } = await supabase.from('inspiration').delete().eq('id', inspirationId);

            setDeleting(false);

            if (error) {
              setActionError(formatSupabaseError(error));
              return;
            }

            notifyInspirationSaved(spaceId);
            router.back();
          },
        },
      ],
    );
  };

  if (loadState === 'loading' && !record) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PeakColors.primary} />
          <Text style={styles.loadingText}>Loading inspiration…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === 'error' && !record) {
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
          <PeakButton title="Try again" onPress={fetchInspiration} style={styles.retryButton} />
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return null;
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
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={PeakColors.textPrimary} />
            </Pressable>
            {isCreator && !isEditing ? (
              <Pressable accessibilityRole="button" hitSlop={12} onPress={startEditing}>
                <Text style={styles.editLink}>Edit</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.eyebrow}>INSPIRATION</Text>

          {isEditing ? (
            <View style={styles.formBlock}>
              <PeakInput
                autoCapitalize="sentences"
                error={titleError ?? undefined}
                label="Title"
                value={editTitle}
                onChangeText={(value) => {
                  setEditTitle(value);
                  if (titleError) setTitleError(null);
                }}
              />
              <PeakInput
                autoCapitalize="none"
                containerStyle={styles.fieldGap}
                keyboardType="url"
                label="URL (optional)"
                value={editUrl}
                onChangeText={setEditUrl}
              />
              <PeakInput
                containerStyle={styles.fieldGap}
                label="Notes (optional)"
                multiline
                numberOfLines={5}
                style={styles.notesInput}
                textAlignVertical="top"
                value={editNotes}
                onChangeText={setEditNotes}
              />
              <View style={styles.editActions}>
                <PeakButton
                  fullWidth
                  loading={saving}
                  title="Save changes"
                  onPress={handleSaveEdit}
                />
                <PeakButton
                  disabled={saving}
                  fullWidth
                  title="Cancel"
                  variant="text"
                  onPress={cancelEditing}
                />
              </View>
            </View>
          ) : (
            <>
              {record.preview_image_url || isInstagramPreviewSource(record.preview_source) ? (
                <InspirationPreviewMedia
                  item={record}
                  fallbackEmoji={record.spaces?.emoji ?? '✨'}
                  fallbackTitle={record.title}
                  fallbackNotes={record.notes}
                  variant="wide"
                  style={styles.previewMedia}
                />
              ) : null}
              <Text style={styles.title}>{record.title}</Text>
              <Text style={styles.createdAt}>Saved {formatCreatedDate(record.created_at)}</Text>
              {record.preview_description &&
              record.preview_description.trim() !== record.notes?.trim() ? (
                <Text style={styles.previewDescription}>{record.preview_description}</Text>
              ) : null}

              {record.notes ? (
                <PeakCard style={styles.sectionCard} padding="md">
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <Text style={styles.notesBody}>{record.notes}</Text>
                </PeakCard>
              ) : (
                <PeakCard style={styles.sectionCard} padding="md">
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <Text style={styles.mutedText}>No notes added.</Text>
                </PeakCard>
              )}

              {record.url ? (
                <PeakCard style={styles.sectionCard} padding="md">
                  <Text style={styles.sectionLabel}>Link</Text>
                  <Text style={styles.urlText} selectable>
                    {record.url}
                  </Text>
                  <PeakButton
                    title="Open link"
                    onPress={() => openUrl(record.url!)}
                    style={styles.openLinkButton}
                  />
                </PeakCard>
              ) : null}
            </>
          )}

          {record.spaces ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/spaces/${record.spaces!.id}`)}>
              <PeakCard style={styles.sectionCard} padding="md">
                <Text style={styles.sectionLabel}>Space</Text>
                <View style={styles.spaceRow}>
                  <Text style={styles.spaceEmoji}>{record.spaces.emoji}</Text>
                  <View style={styles.spaceText}>
                    <Text style={styles.spaceName}>{record.spaces.name}</Text>
                    {record.spaces.destination ? (
                      <Text style={styles.spaceDestination}>{record.spaces.destination}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={PeakColors.textMuted} />
                </View>
              </PeakCard>
            </Pressable>
          ) : null}

          {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}

          {isCreator && !isEditing ? (
            <PeakButton
              disabled={deleting}
              fullWidth
              loading={deleting}
              title="Delete inspiration"
              variant="outline"
              onPress={handleDelete}
              style={styles.deleteButton}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: Spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  editLink: {
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
  eyebrow: {
    ...Typography.caption,
    color: PeakColors.pink,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  previewMedia: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  previewDescription: {
    ...Typography.bodySmall,
    marginTop: Spacing.sm,
  },
  title: {
    ...Typography.h1,
    fontSize: 28,
  },
  createdAt: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  sectionCard: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    color: PeakColors.textSecondary,
  },
  notesBody: {
    ...Typography.body,
  },
  mutedText: {
    ...Typography.bodySmall,
    fontStyle: 'italic',
  },
  urlText: {
    ...Typography.bodySmall,
    color: PeakColors.primary,
  },
  openLinkButton: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
  },
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  spaceEmoji: {
    fontSize: 32,
  },
  spaceText: {
    flex: 1,
  },
  spaceName: {
    ...Typography.h3,
  },
  spaceDestination: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  formBlock: {
    marginBottom: Spacing.lg,
  },
  fieldGap: {
    marginTop: Spacing.md,
  },
  notesInput: {
    minHeight: 120,
    paddingTop: Spacing.sm,
  },
  editActions: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  actionError: {
    ...Typography.caption,
    color: PeakColors.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  deleteButton: {
    marginTop: Spacing.sm,
    borderColor: PeakColors.error,
  },
});
