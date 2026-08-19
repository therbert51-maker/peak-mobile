import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { formatAuthError, useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';
import { safeAuthDestination } from '@/lib/auth-navigation';

export default function ForgotPasswordScreen() {
  const { next: nextParam } = useLocalSearchParams<{ next?: string | string[] }>();
  const next = safeAuthDestination(nextParam);
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Email is required.');
      return;
    }

    setEmailError(null);
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    const { error } = await sendPasswordReset(trimmedEmail, next);
    setSubmitting(false);

    if (error) {
      setFormError(formatAuthError(error));
      return;
    }

    setFormSuccess(
      'If an account exists for that email, Supabase has sent a password-reset link.',
    );
  };

  return (
    <AuthScreenShell
      title="Reset your password"
      subtitle="Enter your account email and we’ll send a secure recovery link.">
      <PeakInput
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={emailError ?? undefined}
        keyboardType="email-address"
        label="Email"
        placeholder="you@example.com"
        textContentType="emailAddress"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (emailError) setEmailError(null);
        }}
      />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      {formSuccess ? <Text style={styles.success}>{formSuccess}</Text> : null}
      <PeakButton
        fullWidth
        loading={submitting}
        title="Send recovery link"
        onPress={handleSubmit}
        style={styles.action}
      />
      <Pressable
        hitSlop={8}
        onPress={() =>
          router.replace({
            pathname: '/sign-in',
            params: { next },
          })
        }
        style={styles.back}>
        <Text style={styles.backText}>Back to Log In</Text>
      </Pressable>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    ...Typography.caption,
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
  back: {
    alignSelf: 'center',
    marginTop: Spacing.md,
    padding: Spacing.xs,
  },
  backText: {
    ...Typography.bodySmall,
    color: PeakColors.primary,
    fontWeight: '700',
  },
});

