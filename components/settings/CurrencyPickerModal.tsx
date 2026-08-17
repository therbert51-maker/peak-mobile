import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from '@/lib/user-profile';

const CURRENCY_NAMES: Record<SupportedCurrency, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  JPY: 'Japanese Yen',
  CHF: 'Swiss Franc',
};

export function CurrencyPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: SupportedCurrency;
  onSelect: (currency: SupportedCurrency) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Preferred currency</Text>
            <Text style={styles.subtitle}>For future display preferences</Text>
          </View>
          <Pressable
            accessibilityLabel="Close currency picker"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onClose}>
            <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.list}>
          {SUPPORTED_CURRENCIES.map((currency) => {
            const isSelected = currency === selected;
            return (
              <Pressable
                key={currency}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(currency)}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}>
                <View style={styles.codeWrap}>
                  <Text style={styles.code}>{currency}</Text>
                </View>
                <Text style={styles.name}>{CURRENCY_NAMES[currency]}</Text>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={23} color={PeakColors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>
          This does not convert existing expenses or change Split calculations.
        </Text>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PeakColors.border,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    ...Typography.h2,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  list: {
    margin: Spacing.lg,
    overflow: 'hidden',
    borderRadius: BorderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  option: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PeakColors.border,
  },
  optionSelected: {
    backgroundColor: PeakColors.primaryLight,
  },
  optionPressed: {
    opacity: 0.75,
  },
  codeWrap: {
    width: 44,
  },
  code: {
    ...Typography.label,
    color: PeakColors.primaryDark,
  },
  name: {
    ...Typography.body,
    flex: 1,
  },
  note: {
    ...Typography.bodySmall,
    textAlign: 'center',
    marginHorizontal: Spacing.xl,
  },
});
