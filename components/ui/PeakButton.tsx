import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing } from '@/constants/theme';

export type PeakButtonVariant = 'primary' | 'secondary' | 'outline' | 'text';

export type PeakButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: PeakButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PeakButton({
  title,
  variant = 'primary',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: PeakButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? PeakColors.textInverse : PeakColors.primary}
          size="small"
        />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label` as const]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  primary: {
    backgroundColor: PeakColors.primary,
  },
  primaryLabel: {
    color: PeakColors.textInverse,
  },
  secondary: {
    backgroundColor: PeakColors.primaryLight,
  },
  secondaryLabel: {
    color: PeakColors.primaryDark,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: PeakColors.borderStrong,
  },
  outlineLabel: {
    color: PeakColors.primary,
  },
  text: {
    backgroundColor: 'transparent',
    minHeight: 40,
    paddingHorizontal: Spacing.sm,
  },
  textLabel: {
    color: PeakColors.primary,
  },
});
