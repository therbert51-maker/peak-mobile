import { StyleSheet, Text, View } from 'react-native';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SettingsDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.sm,
  },
  title: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.xs,
  },
  card: {
    overflow: 'hidden',
    borderRadius: BorderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
    backgroundColor: PeakColors.border,
  },
});
