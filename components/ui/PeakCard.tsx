import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Shadows, Spacing } from '@/constants/theme';

export type PeakCardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  padding?: keyof typeof Spacing;
};

export function PeakCard({
  children,
  onPress,
  onLongPress,
  style,
  elevated = true,
  padding = 'md',
}: PeakCardProps) {
  const cardStyle = [
    styles.card,
    elevated && Shadows.card,
    { padding: Spacing[padding] },
    style,
  ];

  if (onPress || onLongPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PeakColors.surface,
    borderRadius: BorderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
  },
  pressed: {
    opacity: 0.92,
  },
});
