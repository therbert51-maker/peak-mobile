import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

export function PhotoPlaceholder() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="camera-outline" size={28} color={PeakColors.primary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Photo</Text>
        <Text style={styles.subtitle}>Coming soon — add a snapshot of this spot.</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: PeakColors.borderStrong,
    backgroundColor: PeakColors.surfaceMuted,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...Typography.label,
  },
  subtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
    backgroundColor: PeakColors.aquaLight,
  },
  badgeText: {
    ...Typography.caption,
    color: PeakColors.navy,
    fontWeight: '700',
  },
});
