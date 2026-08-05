import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { formatAuthError, useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSignOutError(null);
    setSigningOut(true);

    const { error } = await signOut();

    setSigningOut(false);

    if (error) {
      setSignOutError(formatAuthError(error));
      return;
    }

    router.replace('/sign-in');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>PEAK</Text>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Your account and settings.</Text>

        {user?.email ? (
          <View style={styles.emailCard}>
            <Text style={styles.emailLabel}>Signed in as</Text>
            <Text style={styles.emailValue}>{user.email}</Text>
          </View>
        ) : null}

        {signOutError ? <Text style={styles.error}>{signOutError}</Text> : null}

        <PeakButton
          fullWidth
          loading={signingOut}
          title="Sign out"
          variant="outline"
          onPress={handleSignOut}
          style={styles.signOutButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  eyebrow: {
    ...Typography.caption,
    color: PeakColors.pink,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h1,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: Spacing.xs,
  },
  emailCard: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    borderRadius: 14,
    backgroundColor: PeakColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
  },
  emailLabel: {
    ...Typography.caption,
  },
  emailValue: {
    ...Typography.label,
    marginTop: Spacing.xs,
  },
  error: {
    ...Typography.caption,
    color: PeakColors.error,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  signOutButton: {
    marginTop: Spacing.xl,
  },
});
