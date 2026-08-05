import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { formatAuthError, useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';

export default function SignInScreen() {
  const { signIn, loading: authLoading, session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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

  const handleSignIn = async () => {
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
    } else {
      setPasswordError(null);
    }

    if (invalid) return;

    setFormError(null);
    setSubmitting(true);

    const { error } = await signIn(trimmedEmail, password);

    setSubmitting(false);

    if (error) {
      setFormError(formatAuthError(error));
      return;
    }

    router.replace('/');
  };

  return (
    <AuthScreenShell
      subtitle="Sign in to save inspiration, plan trips, and split with your crew."
      title="Welcome back">
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
        autoComplete="password"
        containerStyle={styles.fieldGap}
        error={passwordError ?? undefined}
        label="Password"
        placeholder="Your password"
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (passwordError) setPasswordError(null);
        }}
      />
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      <PeakButton
        fullWidth
        loading={submitting}
        title="Sign in"
        onPress={handleSignIn}
        style={styles.primaryAction}
      />
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>New to Peak?</Text>
        <Link href="/sign-up" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.footerLink}>Create an account</Text>
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
