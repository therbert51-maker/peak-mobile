import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import {
  instagramPreviewCaption,
  isInstagramPreviewSource,
} from '@/lib/inspiration-preview-caption';
import type { Inspiration } from '@/types/database';

type PreviewFields = Pick<
  Inspiration,
  | 'preview_image_url'
  | 'preview_kind'
  | 'preview_source'
  | 'preview_title'
  | 'preview_description'
>;

function InstagramFallbackBackground() {
  return (
    <>
      <View style={[StyleSheet.absoluteFill, styles.instagramBase]} />
      <View style={[styles.instagramOrb, styles.instagramOrbPurple]} />
      <View style={[styles.instagramOrb, styles.instagramOrbOrange]} />
      <View style={[styles.instagramOrb, styles.instagramOrbPink]} />
    </>
  );
}

function InstagramFallbackPlate({
  caption,
  isVideo,
  variant,
}: {
  caption: string | null;
  isVideo: boolean;
  variant: 'compact' | 'wide';
}) {
  const iconSize = variant === 'compact' ? 26 : 42;

  return (
    <>
      <InstagramFallbackBackground />
      <View style={styles.instagramContent}>
        <View style={variant === 'wide' ? styles.instagramIconWrapWide : undefined}>
          <Ionicons
            name="logo-instagram"
            size={iconSize}
            color={PeakColors.textInverse}
            style={styles.instagramIcon}
          />
          {isVideo ? (
            <View
              style={[
                styles.playBadge,
                variant === 'compact' ? styles.playBadgeCompact : styles.playBadgeWide,
              ]}>
              <Ionicons
                name="play"
                size={variant === 'compact' ? 11 : 16}
                color={PeakColors.textInverse}
              />
            </View>
          ) : null}
        </View>
        {variant === 'wide' && caption ? (
          <View style={styles.instagramCaptionWrap}>
            <Text style={styles.instagramCaption} numberOfLines={2}>
              {caption}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

export function InspirationPreviewMedia({
  item,
  fallbackEmoji = '✨',
  fallbackTitle,
  fallbackNotes,
  variant = 'compact',
  style,
}: {
  item: PreviewFields;
  fallbackEmoji?: string;
  fallbackTitle?: string | null;
  fallbackNotes?: string | null;
  variant?: 'compact' | 'wide';
  style?: StyleProp<ViewStyle>;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [item.preview_image_url]);

  const showImage = Boolean(item.preview_image_url) && !imageFailed;
  const isVideo = item.preview_kind === 'video';
  const showInstagramFallback =
    !showImage && isInstagramPreviewSource(item.preview_source);
  const instagramCaption = showInstagramFallback
    ? instagramPreviewCaption(item, fallbackTitle, fallbackNotes)
    : null;

  return (
    <View
      style={[
        styles.media,
        variant === 'compact' ? styles.compact : styles.wide,
        showInstagramFallback && styles.instagramMedia,
        style,
      ]}>
      {showImage ? (
        <Image
          accessibilityLabel={
            item.preview_source
              ? `${item.preview_source} inspiration preview`
              : 'Inspiration preview'
          }
          contentFit="cover"
          source={{ uri: item.preview_image_url! }}
          style={StyleSheet.absoluteFill}
          transition={180}
          onError={() => setImageFailed(true)}
        />
      ) : showInstagramFallback ? (
        <InstagramFallbackPlate
          caption={instagramCaption}
          isVideo={isVideo}
          variant={variant}
        />
      ) : (
        <Text style={variant === 'compact' ? styles.compactEmoji : styles.wideEmoji}>
          {fallbackEmoji}
        </Text>
      )}

      {showImage && isVideo ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={variant === 'compact' ? 13 : 20} color={PeakColors.textInverse} />
        </View>
      ) : null}

      {item.preview_source ? (
        <View
          style={[
            styles.sourceBadge,
            showInstagramFallback && styles.sourceBadgeInstagram,
          ]}>
          <Text style={styles.sourceText} numberOfLines={1}>
            {item.preview_source}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  media: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.surfaceMuted,
  },
  instagramMedia: {
    backgroundColor: '#C13584',
  },
  compact: {
    width: 64,
    height: 64,
    borderRadius: 17,
  },
  wide: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: BorderRadius.large,
  },
  compactEmoji: {
    fontSize: 30,
  },
  wideEmoji: {
    fontSize: 52,
  },
  instagramBase: {
    backgroundColor: '#C13584',
  },
  instagramOrb: {
    position: 'absolute',
    borderRadius: BorderRadius.pill,
  },
  instagramOrbPurple: {
    width: '95%',
    height: '95%',
    top: '-30%',
    left: '-25%',
    backgroundColor: '#833AB4',
    opacity: 0.72,
  },
  instagramOrbOrange: {
    width: '80%',
    height: '80%',
    bottom: '-35%',
    right: '-20%',
    backgroundColor: '#F77737',
    opacity: 0.78,
  },
  instagramOrbPink: {
    width: '55%',
    height: '55%',
    top: '18%',
    right: '-12%',
    backgroundColor: PeakColors.pink,
    opacity: 0.55,
  },
  instagramContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  instagramIconWrapWide: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  instagramIcon: {
    opacity: 0.96,
  },
  instagramCaptionWrap: {
    position: 'absolute',
    left: Spacing.sm,
    right: Spacing.sm,
    bottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.medium,
    backgroundColor: 'rgba(24, 34, 56, 0.68)',
  },
  instagramCaption: {
    ...Typography.caption,
    color: PeakColors.textInverse,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
  playBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(24, 34, 56, 0.78)',
  },
  playBadgeCompact: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
  },
  playBadgeWide: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 30,
    height: 30,
  },
  sourceBadge: {
    position: 'absolute',
    left: Spacing.xs,
    bottom: Spacing.xs,
    maxWidth: '78%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(24, 34, 56, 0.72)',
  },
  sourceBadgeInstagram: {
    top: Spacing.xs,
    bottom: undefined,
  },
  sourceText: {
    ...Typography.caption,
    color: PeakColors.textInverse,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
  },
});
