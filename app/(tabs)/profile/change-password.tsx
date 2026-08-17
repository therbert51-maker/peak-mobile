import { Ionicons } from '@expo/vector-icons';
import { type AuthError } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { formatAuthError } from '@/contexts/auth-provider';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 6;

export default function ChangePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    let invalid = false;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      invalid = true;
    } else {
      setPasswordError(null);
    }

    if (!confirmPassword) {
      setConfirmError('Confirm your new password.');
      invalid = true;
    } else if (confirmPassword !== password) {
      setConfirmError('Passwords do not match.');
      invalid = true;
    } else {
      setConfirmError(null);
    }

    if (invalid) return;

    setFormError(null);
    setSuccessMessage(null);
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setFormError(formatAuthError(error as AuthError));
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setSuccessMessage('Password updated successfully.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Back to settings"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}>
            <Ionicons name="chevron-back" size={25} color={PeakColors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.introCard}>
            <View style={styles.iconWrap}>
              <Ionicons name="key-outline" size={28} color={PeakColors.primary} />
            </View>
            <Text style={styles.title}>Choose a new password</Text>
            <Text style={styles.subtitle}>
              Use at least {MIN_PASSWORD_LENGTH} characters and keep your account secure.
            </Text>
          </View>

          <View style={styles.form}>
            <PeakInput
              autoCapitalize="none"
              autoComplete="password-new"
              error={passwordError ?? undefined}
              label="New password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setPasswordError(null);
                setSuccessMessage(null);
              }}
              onRightIconPress={() => setShowPassword((value) => !value)}
            />
            <PeakInput
              autoCapitalize="none"
              autoComplete="password-new"
              error={confirmError ?? undefined}
              label="Confirm password"
              placeholder="Re-enter your new password"
              rightIcon={showConfirmation ? 'eye-off-outline' : 'eye-outline'}
              secureTextEntry={!showConfirmation}
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setConfirmError(null);
                setSuccessMessage(null);
              }}
              onRightIconPress={() => setShowConfirmation((value) => !value)}
            />
          </View>

          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          {successMessage ? (
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={21} color={PeakColors.success} />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          <PeakButton
            fullWidth
            loading={saving}
            title="Update Password"
            onPress={() => void handleChangePassword()}
          />
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
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PeakColors.border,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 42,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  introCard: {
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    backgroundColor: PeakColors.primaryLight,
  },
  title: {
    ...Typography.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodySmall,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
  },
  error: {
    ...Typography.bodySmall,
    color: PeakColors.error,
    textAlign: 'center',
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.successLight,
  },
  successText: {
    ...Typography.bodySmall,
    color: PeakColors.success,
    fontWeight: '600',
  },
});
