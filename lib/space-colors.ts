import { PeakColors } from '@/constants/colors';

export const SPACE_COLOR_OPTIONS = [
  { value: PeakColors.primary, background: PeakColors.primaryLight },
  { value: PeakColors.aqua, background: PeakColors.aquaLight },
  { value: PeakColors.pink, background: PeakColors.pinkLight },
  { value: PeakColors.navy, background: '#E4E8F0' },
] as const;

export function colorBackground(color: string): string {
  return (
    SPACE_COLOR_OPTIONS.find((option) => option.value === color)?.background ??
    PeakColors.primaryLight
  );
}
