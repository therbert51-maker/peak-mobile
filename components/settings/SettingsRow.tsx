import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function SettingsRow({
  icon,
  iconColor = PeakColors.primary,
  iconBackground = PeakColors.primaryLight,
  title,
  subtitle,
  value,
  destructive = false,
  disabled = false,
  loading = false,
  onPress,
}: {
  icon: IconName;
  iconColor?: string;
  iconBackground?: string;
  title: string;
  subtitle?: string;
  value?: string;
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
}) {
  const interactive = Boolean(onPress) && !disabled && !loading;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!interactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && interactive && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, destructive && styles.destructive]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={PeakColors.primary} />
      ) : (
        <>
          {value ? (
            <Text style={styles.value} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {onPress ? (
            <Ionicons name="chevron-forward" size={18} color={PeakColors.textMuted} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm + 2,
    backgroundColor: PeakColors.surface,
  },
  pressed: {
    backgroundColor: PeakColors.surfaceMuted,
  },
  disabled: {
    opacity: 0.55,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...Typography.body,
    fontWeight: '500',
  },
  subtitle: {
    ...Typography.caption,
    marginTop: 1,
  },
  value: {
    ...Typography.bodySmall,
    maxWidth: '35%',
    color: PeakColors.textSecondary,
  },
  destructive: {
    color: PeakColors.error,
  },
});
