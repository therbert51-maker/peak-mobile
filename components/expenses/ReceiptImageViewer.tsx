import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';

type ReceiptImageViewerProps = {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
};

export function ReceiptImageViewer({
  visible,
  imageUrl,
  onClose,
}: ReceiptImageViewerProps) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(5, Math.max(1, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) reset();
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const close = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      presentationStyle="fullScreen"
      visible={visible}
      onRequestClose={close}>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.safeArea}>
          <GestureDetector gesture={gesture}>
            <View style={styles.imageViewport}>
              <Animated.View style={[styles.imageWrap, imageStyle]}>
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.image}
                    contentFit="contain"
                  />
                ) : null}
              </Animated.View>
            </View>
          </GestureDetector>

          <View pointerEvents="box-none" style={styles.overlay}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close receipt"
              hitSlop={8}
              onPress={close}
              style={[
                styles.closeButton,
                { top: insets.top + Spacing.sm, right: Spacing.md },
              ]}>
              <Ionicons name="close" size={28} color={PeakColors.textInverse} />
            </Pressable>
          </View>

          <Text style={[styles.hint, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
            Pinch or double-tap to zoom
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  safeArea: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  imageViewport: { flex: 1, overflow: 'hidden' },
  imageWrap: { flex: 1 },
  image: { width: '100%', height: '100%' },
  hint: {
    ...Typography.caption,
    color: PeakColors.textInverse,
    opacity: 0.75,
    textAlign: 'center',
    padding: Spacing.md,
  },
});
