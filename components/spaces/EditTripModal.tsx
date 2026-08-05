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
import { emptyToNull, validateTripDates } from '@/lib/trip-dates';
import type { Space } from '@/types/database';

export type TripEditForm = {
  description: string;
  startDate: string;
  endDate: string;
  airport: string;
  lodging: string;
};

export function tripFormFromSpace(space: Space): TripEditForm {
  return {
    description: space.description ?? '',
    startDate: space.start_date ?? '',
    endDate: space.end_date ?? '',
    airport: space.airport ?? '',
    lodging: space.lodging ?? '',
  };
}

type EditTripModalProps = {
  visible: boolean;
  saving: boolean;
  saveError: string | null;
  form: TripEditForm;
  onChange: (patch: Partial<TripEditForm>) => void;
  onClose: () => void;
  onSave: () => void;
};

export function EditTripModal({
  visible,
  saving,
  saveError,
  form,
  onChange,
  onClose,
  onSave,
}: EditTripModalProps) {
  const dateError = validateTripDates(form.startDate, form.endDate);

  const handleSave = () => {
    if (dateError) return;
    onSave();
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit trip</Text>
            <Pressable accessibilityRole="button" disabled={saving} hitSlop={12} onPress={onClose}>
              <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.hint}>
              Add dates, flights, and stay details so your crew knows the plan.
            </Text>

            <PeakInput
              editable={!saving}
              label="Trip description (optional)"
              multiline
              numberOfLines={4}
              placeholder="What kind of trip is this?"
              style={styles.textArea}
              textAlignVertical="top"
              value={form.description}
              onChangeText={(description) => onChange({ description })}
            />

            <PeakInput
              autoCapitalize="none"
              containerStyle={styles.fieldGap}
              editable={!saving}
              label="Start date (optional)"
              placeholder="YYYY-MM-DD"
              value={form.startDate}
              onChangeText={(startDate) => onChange({ startDate })}
            />

            <PeakInput
              autoCapitalize="none"
              containerStyle={styles.fieldGap}
              editable={!saving}
              error={dateError ?? undefined}
              label="End date (optional)"
              placeholder="YYYY-MM-DD"
              value={form.endDate}
              onChangeText={(endDate) => onChange({ endDate })}
            />

            <PeakInput
              containerStyle={styles.fieldGap}
              editable={!saving}
              label="Airport / flights (optional)"
              placeholder="BCN, 9:40am United 982..."
              value={form.airport}
              onChangeText={(airport) => onChange({ airport })}
            />

            <PeakInput
              containerStyle={styles.fieldGap}
              editable={!saving}
              label="Lodging (optional)"
              placeholder="Hotel name, address, check-in..."
              multiline
              numberOfLines={3}
              style={styles.textAreaSmall}
              textAlignVertical="top"
              value={form.lodging}
              onChangeText={(lodging) => onChange({ lodging })}
            />

            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

            <PeakButton
              disabled={Boolean(dateError)}
              fullWidth
              loading={saving}
              title="Save trip details"
              onPress={handleSave}
              style={styles.saveButton}
            />
            <PeakButton disabled={saving} fullWidth title="Cancel" variant="text" onPress={onClose} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function buildTripUpdatePayload(form: TripEditForm) {
  const dateError = validateTripDates(form.startDate, form.endDate);
  if (dateError) {
    return { error: dateError as string, payload: null };
  }

  return {
    error: null,
    payload: {
      description: emptyToNull(form.description),
      start_date: emptyToNull(form.startDate),
      end_date: emptyToNull(form.endDate),
      airport: emptyToNull(form.airport),
      lodging: emptyToNull(form.lodging),
    },
  };
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
  hint: {
    ...Typography.bodySmall,
    marginBottom: Spacing.md,
  },
  fieldGap: {
    marginTop: Spacing.md,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.sm,
  },
  textAreaSmall: {
    minHeight: 80,
    paddingTop: Spacing.sm,
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
