/**
 * Peak brand palette — aligned with Peak Travel web identity.
 */

export const PeakColors = {
  primary: '#7868E6',
  primaryDark: '#6252D5',
  primaryLight: '#E8E4FA',
  primaryMuted: '#B9B0F0',

  aqua: '#59D5D8',
  aquaLight: '#D4F4F5',
  aquaMuted: '#9EE8EA',

  pink: '#F04F7D',
  pinkLight: '#FDDCE6',
  pinkMuted: '#F89BB5',

  navy: '#182238',
  navyLight: '#2E3A52',
  navyMuted: '#4A5568',

  background: '#FFF9F6',
  surface: '#FFFFFF',
  surfaceMuted: '#FFF3ED',

  textPrimary: '#182238',
  textSecondary: '#697386',
  textMuted: '#9AA3B2',
  textInverse: '#FFFFFF',

  border: '#ECE9EE',
  borderStrong: '#D8D3E0',

  success: '#36B37E',
  successLight: '#D7F0E5',

  error: '#E5484D',
  errorLight: '#FCE8E9',

  /** Tab bar & chrome */
  tabInactive: '#697386',
  tabActive: '#7868E6',
} as const;

export type PeakColorName = keyof typeof PeakColors;
