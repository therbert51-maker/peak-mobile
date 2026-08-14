import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

type AddExpenseChooserModalProps = {
  visible: boolean;
  onClose: () => void;
  onScanReceipt: () => void;
  onChoosePhoto: () => void;
  onEnterManually: () => void;
};

function OptionRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.option}>
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={24} color={PeakColors.primary} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={PeakColors.textMuted} />
    </Pressable>
  );
}

export function AddExpenseChooserModal({
  visible,
  onClose,
  onScanReceipt,
  onChoosePhoto,
  onEnterManually,
}: AddExpenseChooserModalProps) {
  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Add expense</Text>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <OptionRow
            icon="camera-outline"
            title="Scan receipt"
            subtitle="Take a photo and let Peak read the details"
            onPress={onScanReceipt}
          />
          <OptionRow
            icon="images-outline"
            title="Choose from photos"
            subtitle="Upload a receipt from your library"
            onPress={onChoosePhoto}
          />
          <OptionRow
            icon="create-outline"
            title="Enter manually"
            subtitle="Type amounts yourself"
            onPress={onEnterManually}
          />
        </View>

        <PeakButton title="Cancel" variant="outline" onPress={onClose} style={styles.cancel} fullWidth />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
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
  body: {
    padding: Spacing.lg,
    gap: Spacing.md,
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.large,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.label,
  },
  optionSubtitle: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    marginTop: 4,
  },
  cancel: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
