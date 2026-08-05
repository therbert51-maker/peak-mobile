import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { formatAuthError, useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';

const MIN_PASSWORD_LENGTH = 6;

export default function SignUpScreen() {
  const { signUp, loading: authLoading, session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PeakColors.primary} />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/" />;
  }

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    let invalid = false;

    if (!trimmedEmail) {
      setEmailError('Email is required.');
      invalid = true;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError('Password is required.');
      invalid = true;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      invalid = true;
    } else {
      setPasswordError(null);
    }

    if (invalid) return;

    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    const { error, needsEmailConfirmation } = await signUp(trimmedEmail, password);

    setSubmitting(false);

    if (error) {
      setFormError(formatAuthError(error));
      return;
    }

    if (needsEmailConfirmation) {
      setFormSuccess('Check your email to confirm your account, then sign in.');
      setPassword('');
      return;
    }

    router.replace('/');
  };

  return (
    <AuthScreenShell
      subtitle="Create your account and start saving trip inspiration with your group."
      title="Join Peak">
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
      <PeakInput
        autoCapitalize="none"
        autoComplete="password-new"
        containerStyle={styles.fieldGap}
        error={passwordError ?? undefined}
        label="Password"
        placeholder="At least 6 characters"
        secureTextEntry
        textContentType="newPassword"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (passwordError) setPasswordError(null);
        }}
      />
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      {formSuccess ? <Text style={styles.formSuccess}>{formSuccess}</Text> : null}
      <PeakButton
        fullWidth
        loading={submitting}
        title="Create account"
        onPress={handleSignUp}
        style={styles.primaryAction}
      />
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Link href="/sign-in" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.footerLink}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.background,
  },
  fieldGap: {
    marginTop: Spacing.md,
  },
  formError: {
    ...Typography.caption,
    color: PeakColors.error,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  formSuccess: {
    ...Typography.caption,
    color: PeakColors.success,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  primaryAction: {
    marginTop: Spacing.xl,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
  },
  footerText: {
    ...Typography.bodySmall,
  },
  footerLink: {
    ...Typography.bodySmall,
    color: PeakColors.primary,
    fontWeight: '700',
  },
});
