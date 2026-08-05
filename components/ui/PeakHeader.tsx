import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';

export type PeakHeaderProps = {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function PeakHeader({ title, subtitle, left, right, style }: PeakHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.side}>{left}</View>
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  side: {
    minWidth: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...Typography.h3,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.caption,
    marginTop: 2,
    textAlign: 'center',
    color: PeakColors.textSecondary,
  },
});
