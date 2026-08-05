import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

type AuthScreenShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AuthScreenShell({ title, subtitle, children }: AuthScreenShellProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <Text style={styles.eyebrow}>PEAK</Text>
            <View style={styles.accentRow}>
              <View style={[styles.accentDot, styles.accentPurple]} />
              <View style={[styles.accentDot, styles.accentAqua]} />
              <View style={[styles.accentDot, styles.accentPink]} />
            </View>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.formCard}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  brandBlock: {
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    ...Typography.caption,
    color: PeakColors.pink,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  accentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.pill,
  },
  accentPurple: {
    backgroundColor: PeakColors.primary,
  },
  accentAqua: {
    backgroundColor: PeakColors.aqua,
  },
  accentPink: {
    backgroundColor: PeakColors.pink,
  },
  title: {
    ...Typography.h1,
    color: PeakColors.navy,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    maxWidth: 320,
  },
  formCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: PeakColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
  },
});
