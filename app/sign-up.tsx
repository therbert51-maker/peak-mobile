import {
  Link,
  Redirect,
  router,
  useLocalSearchParams,
  type Href,
} from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { formatAuthError, useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';
import { safeAuthDestination } from '@/lib/auth-navigation';

const MIN_PASSWORD_LENGTH = 6;

export default function SignUpScreen() {
  const { next: nextParam } = useLocalSearchParams<{ next?: string | string[] }>();
  const next = safeAuthDestination(nextParam);
  const { signUp, loading: authLoading, session } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
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
    return <Redirect href={next as Href} />;
  }

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    let invalid = false;

    if (!trimmedFirstName) {
      setFirstNameError('First name is required.');
      invalid = true;
    } else {
      setFirstNameError(null);
    }

    if (!trimmedLastName) {
      setLastNameError('Last name is required.');
      invalid = true;
    } else {
      setLastNameError(null);
    }

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

    if (!confirmPassword) {
      setConfirmPasswordError('Confirm your password.');
      invalid = true;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match.');
      invalid = true;
    } else {
      setConfirmPasswordError(null);
    }

    if (invalid) return;

    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    const { error, needsEmailConfirmation } = await signUp({
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: trimmedEmail,
      password,
      next,
    });

    setSubmitting(false);

    if (error) {
      setFormError(formatAuthError(error));
      return;
    }

    if (needsEmailConfirmation) {
      setFormSuccess(
        'Check your email to confirm your account. The confirmation link will return you to Peak.',
      );
      setPassword('');
      setConfirmPassword('');
      return;
    }

    router.replace(next as Href);
  };

  return (
    <AuthScreenShell
      subtitle="Create your account and start saving trip inspiration with your group."
      title="Join Peak">
      <PeakInput
        autoCapitalize="words"
        autoComplete="given-name"
        error={firstNameError ?? undefined}
        label="First name"
        placeholder="Taylor"
        textContentType="givenName"
        value={firstName}
        onChangeText={(value) => {
          setFirstName(value);
          if (firstNameError) setFirstNameError(null);
        }}
      />
      <PeakInput
        autoCapitalize="words"
        autoComplete="family-name"
        containerStyle={styles.fieldGap}
        error={lastNameError ?? undefined}
        label="Last name"
        placeholder="Morgan"
        textContentType="familyName"
        value={lastName}
        onChangeText={(value) => {
          setLastName(value);
          if (lastNameError) setLastNameError(null);
        }}
      />
      <PeakInput
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        containerStyle={styles.fieldGap}
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
      <PeakInput
        autoCapitalize="none"
        autoComplete="password-new"
        containerStyle={styles.fieldGap}
        error={confirmPasswordError ?? undefined}
        label="Confirm password"
        placeholder="Re-enter your password"
        secureTextEntry
        textContentType="newPassword"
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          if (confirmPasswordError) setConfirmPasswordError(null);
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
        <Link
          href={{
            pathname: '/sign-in',
            params: { next },
          }}
          asChild>
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
