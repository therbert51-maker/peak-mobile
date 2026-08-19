import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';
import { safeAuthDestination } from '@/lib/auth-navigation';
import { supabase } from '@/lib/supabase';

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordScreen() {
  const { next: nextParam } = useLocalSearchParams<{ next?: string | string[] }>();
  const next = safeAuthDestination(nextParam);
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    let invalid = false;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      invalid = true;
    } else {
      setPasswordError(null);
    }

    if (confirmPassword !== password) {
      setConfirmError('Passwords do not match.');
      invalid = true;
    } else {
      setConfirmError(null);
    }

    if (invalid) return;

    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setFormSuccess('Your password has been updated.');
  };

  return (
    <AuthScreenShell
      title="Choose a new password"
      subtitle="Use a password you haven’t used for Peak before.">
      {!session ? (
        <>
          <Text style={styles.error}>
            Open the latest password-reset link from your email to continue.
          </Text>
          <PeakButton
            fullWidth
            title="Request another link"
            onPress={() =>
              router.replace({
                pathname: '/forgot-password',
                params: { next },
              } as unknown as Href)
            }
            style={styles.action}
          />
        </>
      ) : (
        <>
          <PeakInput
            autoCapitalize="none"
            autoComplete="password-new"
            error={passwordError ?? undefined}
            label="New password"
            placeholder="At least 6 characters"
            secureTextEntry
            textContentType="newPassword"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (passwordError) setPasswordError(null);
            }}
          />
          <PeakInput
            autoCapitalize="none"
            autoComplete="password-new"
            containerStyle={styles.fieldGap}
            error={confirmError ?? undefined}
            label="Confirm password"
            placeholder="Re-enter your password"
            secureTextEntry
            textContentType="newPassword"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              if (confirmError) setConfirmError(null);
            }}
          />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          {formSuccess ? <Text style={styles.success}>{formSuccess}</Text> : null}
          {formSuccess ? (
            <PeakButton
              fullWidth
              title={next === '/' ? 'Continue to Peak' : 'Return to invitation'}
              onPress={() => router.replace(next as Href)}
              style={styles.action}
            />
          ) : (
            <PeakButton
              fullWidth
              loading={submitting}
              title="Update password"
              onPress={handleReset}
              style={styles.action}
            />
          )}
        </>
      )}
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  fieldGap: {
    marginTop: Spacing.md,
  },
  error: {
    ...Typography.bodySmall,
    color: PeakColors.error,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  success: {
    ...Typography.bodySmall,
    color: PeakColors.success,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.lg,
  },
});

