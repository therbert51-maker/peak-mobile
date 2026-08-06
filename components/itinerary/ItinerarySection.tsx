import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  emptyEventForm,
  EventFormModal,
  type EventFormState,
} from '@/components/itinerary/EventFormModal';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakCard } from '@/components/ui/PeakCard';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import {
  CATEGORY_META,
  groupItineraryByDate,
  formatItineraryTime,
  normalizeTimeForDb,
  STATUS_META,
  type ItineraryCategory,
  type ItineraryStatus,
  validateItineraryTimes,
} from '@/lib/itinerary';
import { formatSupabaseError } from '@/lib/spaces';
import { emptyToNull, parseIsoDate } from '@/lib/trip-dates';
import { supabase } from '@/lib/supabase';
import type { ItineraryItem } from '@/types/database';

type ItineraryLoadState = 'loading' | 'success' | 'error';

type ItinerarySectionProps = {
  spaceId: string;
  spaceOwnerId: string | null;
  userId: string | undefined;
};

function formFromItem(item: ItineraryItem): EventFormState {
  const trimTime = (t: string | null) => (t ? t.slice(0, 5) : '');
  return {
    title: item.title,
    eventDate: item.event_date,
    startTime: trimTime(item.start_time),
    endTime: trimTime(item.end_time),
    category: item.category as ItineraryCategory,
    location: item.location ?? '',
    description: item.description ?? '',
    status: item.status as ItineraryStatus,
  };
}

export function ItinerarySection({ spaceId, spaceOwnerId, userId }: ItinerarySectionProps) {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loadState, setLoadState] = useState<ItineraryLoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyEventForm());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const canManageItem = useCallback(
    (item: ItineraryItem) =>
      Boolean(userId && (userId === item.created_by || userId === spaceOwnerId)),
    [spaceOwnerId, userId],
  );

  const fetchItinerary = useCallback(async () => {
    setLoadState('loading');
    setErrorMessage(null);

    const { data, error } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('space_id', spaceId)
      .order('event_date', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });

    if (error) {
      setErrorMessage(error.message || 'Could not load itinerary.');
      setItems([]);
      setLoadState('error');
      return;
    }

    setItems(data ?? []);
    setLoadState('success');
  }, [spaceId]);

  useEffect(() => {
    fetchItinerary();
  }, [fetchItinerary]);

  const openCreate = () => {
    setModalMode('create');
    setEditingItemId(null);
    setForm(emptyEventForm());
    setSaveError(null);
    setModalVisible(true);
  };

  const openEdit = (item: ItineraryItem) => {
    setModalMode('edit');
    setEditingItemId(item.id);
    setForm(formFromItem(item));
    setSaveError(null);
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setSaveError(null);
  };

  const nextSortOrder = (eventDate: string) => {
    const sameDay = items.filter((item) => item.event_date === eventDate);
    if (sameDay.length === 0) return 0;
    return Math.max(...sameDay.map((item) => item.sort_order)) + 1;
  };

  const handleSave = async () => {
    if (!userId) {
      setSaveError('You must be signed in to save events.');
      return;
    }

    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      setSaveError('Title is required.');
      return;
    }
    if (!form.eventDate.trim() || !parseIsoDate(form.eventDate)) {
      setSaveError('A valid date (YYYY-MM-DD) is required.');
      return;
    }

    const timeError = validateItineraryTimes(form.startTime, form.endTime);
    if (timeError) {
      setSaveError(timeError);
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload = {
      title: trimmedTitle,
      event_date: form.eventDate.trim(),
      start_time: normalizeTimeForDb(form.startTime),
      end_time: normalizeTimeForDb(form.endTime),
      category: form.category,
      status: form.status,
      location: emptyToNull(form.location),
      description: emptyToNull(form.description),
    };

    if (modalMode === 'create') {
      const { error } = await supabase.from('itinerary_items').insert({
        ...payload,
        space_id: spaceId,
        created_by: userId,
        sort_order: nextSortOrder(payload.event_date),
      });

      setSaving(false);
      if (error) {
        setSaveError(formatSupabaseError(error));
        return;
      }
    } else if (editingItemId) {
      const { error } = await supabase
        .from('itinerary_items')
        .update(payload)
        .eq('id', editingItemId);

      setSaving(false);
      if (error) {
        setSaveError(formatSupabaseError(error));
        return;
      }
    }

    setModalVisible(false);
    await fetchItinerary();
  };

  const handleDelete = (item: ItineraryItem) => {
    Alert.alert('Delete event?', `Remove “${item.title}” from the itinerary?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('itinerary_items').delete().eq('id', item.id);
          if (error) {
            Alert.alert('Could not delete', formatSupabaseError(error));
            return;
          }
          await fetchItinerary();
        },
      },
    ]);
  };

  const moveItem = async (item: ItineraryItem, direction: 'up' | 'down') => {
    const dayItems = items
      .filter((row) => row.event_date === item.event_date)
      .sort((a, b) => a.sort_order - b.sort_order || (a.start_time ?? '').localeCompare(b.start_time ?? ''));

    const index = dayItems.findIndex((row) => row.id === item.id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= dayItems.length) return;

    const other = dayItems[swapIndex];
    setReorderingId(item.id);

    const [first, second] = await Promise.all([
      supabase.from('itinerary_items').update({ sort_order: other.sort_order }).eq('id', item.id),
      supabase.from('itinerary_items').update({ sort_order: item.sort_order }).eq('id', other.id),
    ]);

    setReorderingId(null);

    if (first.error || second.error) {
      Alert.alert(
        'Could not reorder',
        formatSupabaseError(first.error ?? second.error ?? { message: 'Unknown error' }),
      );
      return;
    }

    await fetchItinerary();
  };

  const groups = groupItineraryByDate(items);

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Itinerary</Text>
        <PeakButton title="Add event" onPress={openCreate} />
      </View>

      {loadState === 'loading' ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={PeakColors.primary} />
          <Text style={styles.loadingText}>Loading itinerary…</Text>
        </View>
      ) : null}

      {loadState === 'error' ? (
        <PeakCard padding="md" style={styles.blockCard}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <PeakButton title="Retry" variant="outline" onPress={fetchItinerary} style={styles.retryBtn} />
        </PeakCard>
      ) : null}

      {loadState === 'success' && items.length === 0 ? (
        <PeakCard padding="md" style={styles.blockCard}>
          <Text style={styles.emptyEmoji}>🗓️</Text>
          <Text style={styles.emptyTitle}>No events yet</Text>
          <Text style={styles.emptyMessage}>Build your day-by-day plan with flights, meals, and activities.</Text>
          <PeakButton title="Add event" onPress={openCreate} style={styles.retryBtn} />
        </PeakCard>
      ) : null}

      {loadState === 'success' && groups.length > 0 ? (
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.eventDate} style={styles.dayGroup}>
              <Text style={styles.dayHeader}>{group.headerLabel}</Text>
              {group.items.map((item, index) => {
                const meta = CATEGORY_META[item.category as ItineraryCategory] ?? CATEGORY_META.other;
                const statusMeta = STATUS_META[item.status as ItineraryStatus] ?? STATUS_META.planned;
                const timeLabel = formatItineraryTime(item.start_time);
                const manageable = canManageItem(item);
                const dayItems = group.items;
                const canMoveUp = index > 0;
                const canMoveDown = index < dayItems.length - 1;

                return (
                  <PeakCard key={item.id} padding="md" style={styles.eventCard}>
                    <View style={styles.eventTop}>
                      <View style={styles.categoryIcon}>
                        <Ionicons name={meta.icon} size={18} color={PeakColors.primary} />
                      </View>
                      <View style={styles.eventMain}>
                        {timeLabel ? <Text style={styles.eventTime}>{timeLabel}</Text> : null}
                        <Text style={styles.eventTitle}>{item.title}</Text>
                        {item.location ? (
                          <Text style={styles.eventLocation}>{item.location}</Text>
                        ) : null}
                        {item.description ? (
                          <Text style={styles.eventNotes} numberOfLines={3}>
                            {item.description}
                          </Text>
                        ) : null}
                        <View style={[styles.statusBadge, { backgroundColor: `${statusMeta.color}22` }]}>
                          <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                            {statusMeta.label}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {manageable ? (
                      <View style={styles.actionsRow}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={!canMoveUp || reorderingId === item.id}
                          hitSlop={8}
                          onPress={() => moveItem(item, 'up')}
                          style={[styles.iconAction, !canMoveUp && styles.iconActionDisabled]}>
                          <Ionicons name="chevron-up" size={20} color={PeakColors.textSecondary} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          disabled={!canMoveDown || reorderingId === item.id}
                          hitSlop={8}
                          onPress={() => moveItem(item, 'down')}
                          style={[styles.iconAction, !canMoveDown && styles.iconActionDisabled]}>
                          <Ionicons name="chevron-down" size={20} color={PeakColors.textSecondary} />
                        </Pressable>
                        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => openEdit(item)}>
                          <Text style={styles.textAction}>Edit</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => handleDelete(item)}>
                          <Text style={[styles.textAction, styles.deleteAction]}>Delete</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </PeakCard>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}

      <EventFormModal
        form={form}
        mode={modalMode}
        saveError={saveError}
        saving={saving}
        visible={modalVisible}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onClose={closeModal}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  blockCard: {
    marginHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  loadingWrap: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.bodySmall,
  },
  errorText: {
    ...Typography.bodySmall,
    textAlign: 'center',
    color: PeakColors.error,
  },
  retryBtn: {
    marginTop: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.sm,
  },
  emptyMessage: {
    ...Typography.bodySmall,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  groups: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  dayGroup: {
    gap: Spacing.sm,
  },
  dayHeader: {
    ...Typography.h3,
    color: PeakColors.navy,
  },
  eventCard: {
    marginBottom: Spacing.xs,
  },
  eventTop: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMain: {
    flex: 1,
  },
  eventTime: {
    ...Typography.caption,
    fontWeight: '700',
    color: PeakColors.primary,
  },
  eventTitle: {
    ...Typography.label,
    marginTop: 2,
  },
  eventLocation: {
    ...Typography.bodySmall,
    marginTop: Spacing.xs,
  },
  eventNotes: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  statusBadgeText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PeakColors.border,
  },
  iconAction: {
    padding: Spacing.xs,
  },
  iconActionDisabled: {
    opacity: 0.35,
  },
  textAction: {
    ...Typography.caption,
    fontWeight: '700',
    color: PeakColors.primary,
  },
  deleteAction: {
    color: PeakColors.error,
  },
});
