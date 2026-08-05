/**
 * Peak design tokens — spacing, radius, shadows, typography, and legacy theme hooks.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { PeakColors } from '@/constants/colors';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  small: 8,
  medium: 14,
  large: 20,
  xl: 28,
  pill: 999,
} as const;

const shadowBase = {
  shadowColor: PeakColors.navy,
  shadowOffset: { width: 0, height: 2 },
} as const;

export const Shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      ...shadowBase,
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  floating: Platform.select<ViewStyle>({
    ios: {
      ...shadowBase,
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }),
  subtle: Platform.select<ViewStyle>({
    ios: {
      ...shadowBase,
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }),
} as const;

export const Typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -1,
    color: PeakColors.textPrimary,
  },
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: PeakColors.textPrimary,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: PeakColors.textPrimary,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: PeakColors.textPrimary,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: PeakColors.textPrimary,
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: PeakColors.textSecondary,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: PeakColors.textPrimary,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: PeakColors.textSecondary,
  },
} as const satisfies Record<string, TextStyle>;

/** @deprecated Prefer PeakColors — kept for existing themed components */
export const Colors = {
  light: {
    text: PeakColors.textPrimary,
    background: PeakColors.background,
    tint: PeakColors.primary,
    icon: PeakColors.textSecondary,
    tabIconDefault: PeakColors.tabInactive,
    tabIconSelected: PeakColors.tabActive,
  },
  dark: {
    text: PeakColors.textInverse,
    background: PeakColors.navy,
    tint: PeakColors.primaryMuted,
    icon: PeakColors.textMuted,
    tabIconDefault: PeakColors.textMuted,
    tabIconSelected: PeakColors.primaryMuted,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
