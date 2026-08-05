import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

type SaveSuccessModalProps = {
  visible: boolean;
  message?: string;
};

export function SaveSuccessModal({
  visible,
  message = 'Your inspiration is ready on Home.',
}: SaveSuccessModalProps) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      scale.value = 0.4;
      opacity.value = 0;
      return;
    }

    opacity.value = withSpring(1, { damping: 14 });
    scale.value = withDelay(80, withSpring(1, { damping: 10, stiffness: 120 }));
  }, [visible, opacity, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.92 + scale.value * 0.08 }],
  }));

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Animated.View style={[styles.iconWrap, iconStyle]}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark" size={42} color={PeakColors.textInverse} />
            </View>
          </Animated.View>
          <Text style={styles.title}>Saved!</Text>
          <Text style={styles.message}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 34, 56, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: PeakColors.surface,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.pill,
    backgroundColor: PeakColors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.h2,
    color: PeakColors.success,
  },
  message: {
    ...Typography.bodySmall,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
