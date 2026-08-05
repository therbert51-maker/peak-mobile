import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { PeakColors } from '@/constants/colors';

export type AvatarSize = 'sm' | 'md' | 'lg';

export type AvatarProps = {
  initials?: string;
  source?: ImageSourcePropType;
  size?: AvatarSize;
  backgroundColor?: string;
};

const SIZE_MAP: Record<AvatarSize, number> = {
  sm: 36,
  md: 46,
  lg: 56,
};

const FONT_MAP: Record<AvatarSize, number> = {
  sm: 12,
  md: 13,
  lg: 16,
};

export function Avatar({
  initials,
  source,
  size = 'md',
  backgroundColor = PeakColors.navy,
}: AvatarProps) {
  const dimension = SIZE_MAP[size];

  if (source) {
    return (
      <Image
        source={source}
        style={[
          styles.image,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          },
        ]}
      />
    );
  }

  const label = (initials ?? '?').slice(0, 2).toUpperCase();

  return (
    <View
      style={[
        styles.fallback,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor,
        },
      ]}>
      <Text style={[styles.initials, { fontSize: FONT_MAP[size] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: PeakColors.border,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: PeakColors.textInverse,
    fontWeight: '700',
  },
});
