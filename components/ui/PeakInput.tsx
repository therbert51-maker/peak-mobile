import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type PeakInputProps = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: IoniconName;
  rightIcon?: IoniconName;
  onRightIconPress?: () => void;
};

export function PeakInput({
  label,
  error,
  containerStyle,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  editable = true,
  ...rest
}: PeakInputProps) {
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputRow,
          hasError && styles.inputRowError,
          !editable && styles.inputRowDisabled,
        ]}>
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={hasError ? PeakColors.error : PeakColors.textSecondary}
            style={styles.leftIcon}
          />
        ) : null}
        <TextInput
          placeholderTextColor={PeakColors.textMuted}
          style={[styles.input, leftIcon && styles.inputWithLeftIcon, style]}
          editable={editable}
          {...rest}
        />
        {rightIcon ? (
          <Pressable
            accessibilityRole={onRightIconPress ? 'button' : undefined}
            disabled={!onRightIconPress}
            hitSlop={8}
            onPress={onRightIconPress}
            style={styles.rightIconPressable}>
            <Ionicons
              name={rightIcon}
              size={20}
              color={hasError ? PeakColors.error : PeakColors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {hasError ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.label,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  inputRowError: {
    borderColor: PeakColors.error,
    backgroundColor: PeakColors.errorLight,
  },
  inputRowDisabled: {
    backgroundColor: PeakColors.surfaceMuted,
    opacity: 0.8,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
  },
  inputWithLeftIcon: {
    paddingLeft: Spacing.xs,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  rightIconPressable: {
    marginLeft: Spacing.sm,
  },
  error: {
    ...Typography.caption,
    color: PeakColors.error,
  },
});
