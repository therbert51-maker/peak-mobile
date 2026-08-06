import { Ionicons } from '@expo/vector-icons';
import {
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
import {
  CATEGORY_META,
  ITINERARY_CATEGORIES,
  ITINERARY_STATUSES,
  STATUS_META,
  type ItineraryCategory,
  type ItineraryStatus,
  validateItineraryTimes,
} from '@/lib/itinerary';
import { parseIsoDate } from '@/lib/trip-dates';

export type EventFormState = {
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  category: ItineraryCategory;
  location: string;
  description: string;
  status: ItineraryStatus;
};

export const emptyEventForm = (): EventFormState => ({
  title: '',
  eventDate: '',
  startTime: '',
  endTime: '',
  category: 'activity',
  location: '',
  description: '',
  status: 'planned',
});

type EventFormModalProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  saving: boolean;
  saveError: string | null;
  form: EventFormState;
  onChange: (patch: Partial<EventFormState>) => void;
  onClose: () => void;
  onSave: () => void;
};

export function EventFormModal({
  visible,
  mode,
  saving,
  saveError,
  form,
  onChange,
  onClose,
  onSave,
}: EventFormModalProps) {
  const timeError = validateItineraryTimes(form.startTime, form.endTime);
  const dateValid = !form.eventDate.trim() || parseIsoDate(form.eventDate) !== null;
  const dateError = form.eventDate.trim() && !dateValid ? 'Date must be YYYY-MM-DD.' : null;

  const canSave = form.title.trim().length > 0 && form.eventDate.trim().length > 0 && !timeError && !dateError;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <View style={styles.header}>
            <Text style={styles.title}>{mode === 'create' ? 'Add event' : 'Edit event'}</Text>
            <Pressable accessibilityRole="button" disabled={saving} hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <PeakInput
              editable={!saving}
              label="Title"
              placeholder="Flight to Madrid"
              value={form.title}
              onChangeText={(title) => onChange({ title })}
            />

            <PeakInput
              autoCapitalize="none"
              containerStyle={styles.fieldGap}
              editable={!saving}
              error={dateError ?? undefined}
              label="Date"
              placeholder="YYYY-MM-DD"
              value={form.eventDate}
              onChangeText={(eventDate) => onChange({ eventDate })}
            />

            <PeakInput
              autoCapitalize="none"
              containerStyle={styles.fieldGap}
              editable={!saving}
              label="Start time (optional)"
              placeholder="09:00"
              value={form.startTime}
              onChangeText={(startTime) => onChange({ startTime })}
            />

            <PeakInput
              autoCapitalize="none"
              containerStyle={styles.fieldGap}
              editable={!saving}
              error={timeError ?? undefined}
              label="End time (optional)"
              placeholder="11:30"
              value={form.endTime}
              onChangeText={(endTime) => onChange({ endTime })}
            />

            <View style={styles.fieldGap}>
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {ITINERARY_CATEGORIES.map((category) => {
                  const selected = form.category === category;
                  const meta = CATEGORY_META[category];
                  return (
                    <Pressable
                      key={category}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={saving}
                      onPress={() => onChange({ category })}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <Ionicons
                        name={meta.icon}
                        size={16}
                        color={selected ? PeakColors.primaryDark : PeakColors.textSecondary}
                      />
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{meta.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.fieldGap}>
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusRow}>
                {ITINERARY_STATUSES.map((status) => {
                  const selected = form.status === status;
                  const meta = STATUS_META[status];
                  return (
                    <Pressable
                      key={status}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={saving}
                      onPress={() => onChange({ status })}
                      style={[
                        styles.statusChip,
                        selected && { backgroundColor: `${meta.color}22`, borderColor: meta.color },
                      ]}>
                      <Text style={[styles.statusChipText, selected && { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <PeakInput
              containerStyle={styles.fieldGap}
              editable={!saving}
              label="Location (optional)"
              placeholder="Barajas Airport, Terminal 4"
              value={form.location}
              onChangeText={(location) => onChange({ location })}
            />

            <PeakInput
              containerStyle={styles.fieldGap}
              editable={!saving}
              label="Notes (optional)"
              multiline
              numberOfLines={4}
              placeholder="Confirmation code, dress code, tips..."
              style={styles.notesInput}
              textAlignVertical="top"
              value={form.description}
              onChangeText={(description) => onChange({ description })}
            />

            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

            <PeakButton
              disabled={!canSave}
              fullWidth
              loading={saving}
              title={mode === 'create' ? 'Add event' : 'Save changes'}
              onPress={onSave}
              style={styles.saveButton}
            />
            <PeakButton disabled={saving} fullWidth title="Cancel" variant="text" onPress={onClose} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PeakColors.border,
  },
  title: {
    ...Typography.h2,
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  fieldGap: {
    marginTop: Spacing.md,
  },
  fieldLabel: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  notesInput: {
    minHeight: 100,
    paddingTop: Spacing.sm,
  },
  chipRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  chipSelected: {
    borderColor: PeakColors.primary,
    backgroundColor: PeakColors.primaryLight,
  },
  chipText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: PeakColors.primaryDark,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statusChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  statusChipText: {
    ...Typography.caption,
    fontWeight: '600',
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
});
