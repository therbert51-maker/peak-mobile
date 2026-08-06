import { StyleSheet, Text, View } from 'react-native';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

export function ExpensesEmptyState() {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={styles.illustration}>
        <Text style={styles.receiptIcon}>🧾</Text>
        <View style={styles.coin}>
          <Text style={styles.coinText}>$</Text>
        </View>
      </View>
      <Text style={styles.title}>No expenses yet</Text>
      <Text style={styles.message}>
        Track what your group spends on this trip. Tap + to add your first expense.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  illustration: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  receiptIcon: {
    fontSize: 72,
  },
  coin: {
    position: 'absolute',
    right: 4,
    bottom: 8,
    width: 40,
    height: 40,
    borderRadius: BorderRadius.pill,
    backgroundColor: PeakColors.primaryLight,
    borderWidth: 2,
    borderColor: PeakColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: {
    fontSize: 18,
    fontWeight: '800',
    color: PeakColors.primaryDark,
  },
  title: {
    ...Typography.h2,
    textAlign: 'center',
  },
  message: {
    ...Typography.bodySmall,
    color: PeakColors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    maxWidth: 280,
  },
});
