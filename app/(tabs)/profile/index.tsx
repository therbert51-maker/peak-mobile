import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CurrencyPickerModal } from '@/components/settings/CurrencyPickerModal';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsDivider, SettingsSection } from '@/components/settings/SettingsSection';
import { Avatar } from '@/components/ui/Avatar';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { formatAuthError, useAuth } from '@/contexts/auth-provider';
import { useUserProfile } from '@/hooks/use-user-profile';
import { resetToSignIn } from '@/lib/auth-app-navigation';
import {
  profileDisplayName,
  profileInitials,
  type SupportedCurrency,
} from '@/lib/user-profile';

function showPlaceholder(title: string) {
  Alert.alert(title, 'This will be available in a future Peak update.');
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { profile, loadState, errorMessage, refresh, save } = useUserProfile(user?.id);
  const visibleProfile = profile && user?.id && profile.id === user.id ? profile : null;
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleCurrencySelect = async (currency: SupportedCurrency) => {
    setCurrencyPickerVisible(false);
    if (!visibleProfile || currency === visibleProfile.preferredCurrency) return;

    setPreferenceSaving(true);
    setPreferenceMessage(null);
    const result = await save({ ...visibleProfile, preferredCurrency: currency });
    setPreferenceSaving(false);
    setPreferenceMessage(result.error ?? 'Preferred currency updated.');
  };

  const handleSignOut = async () => {
    setSignOutError(null);
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);

    if (error) {
      setSignOutError(formatAuthError(error));
      return;
    }

    resetToSignIn();
  };

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out of Peak?',
      'You can log back in anytime. Your trips, invites, and profile stay in Peak.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            void handleSignOut();
          },
        },
      ],
    );
  };

  const confirmDeleteAccount = () => {
    // TODO: Replace this informational second step with a protected Edge
    // Function that performs service-role deletion and related-data cleanup.
    Alert.alert(
      'Delete your account?',
      'This would permanently remove your Peak account and cannot be undone. Trip data involving other members may need to be retained for shared records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Secure deletion coming next',
              'Account deletion is not enabled yet. It requires a protected server function and cannot be performed safely from Expo Go.',
            ),
        },
      ],
    );
  };

  const displayName = visibleProfile
    ? profileDisplayName(visibleProfile, user?.email)
    : 'Peak traveler';
  const initials = visibleProfile ? profileInitials(visibleProfile, user?.email) : 'P';
  const avatarSource = visibleProfile?.avatarUrl ? { uri: visibleProfile.avatarUrl } : undefined;
  const loadingProfile = loadState === 'loading' || !visibleProfile;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>PEAK</Text>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Your account and preferences.</Text>
        </View>

        <SettingsSection title="PROFILE">
          <View style={styles.profileSummary}>
            <Avatar initials={initials} source={avatarSource} size="lg" />
            <View style={styles.profileCopy}>
              <Text style={styles.profileName} numberOfLines={1}>
                {loadingProfile ? 'Loading profile…' : displayName}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {user?.email ?? 'Email unavailable'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/(tabs)/profile/edit')}
              style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
              <Ionicons name="pencil" size={18} color={PeakColors.primary} />
            </Pressable>
          </View>
          <SettingsDivider />
          <SettingsRow
            icon="person-outline"
            title="First name"
            value={visibleProfile?.firstName || 'Not set'}
          />
          <SettingsDivider />
          <SettingsRow
            icon="person-outline"
            iconColor={PeakColors.aqua}
            iconBackground={PeakColors.aquaLight}
            title="Last name"
            value={visibleProfile?.lastName || 'Not set'}
          />
          <SettingsDivider />
          <SettingsRow
            icon="at-outline"
            iconColor={PeakColors.pink}
            iconBackground={PeakColors.pinkLight}
            title="Display name"
            value={visibleProfile?.displayName || 'Not set'}
          />
          <SettingsDivider />
          <SettingsRow
            icon="mail-outline"
            title="Email"
            subtitle="Managed by Supabase Auth"
            value={user?.email ?? 'Unavailable'}
          />
          <SettingsDivider />
          <SettingsRow
            icon="create-outline"
            title="Edit Profile"
            onPress={() => router.push('/(tabs)/profile/edit')}
          />
        </SettingsSection>

        <SettingsSection title="PREFERENCES">
          <SettingsRow
            icon="cash-outline"
            iconColor={PeakColors.aqua}
            iconBackground={PeakColors.aquaLight}
            title="Preferred currency"
            subtitle="No exchange-rate conversion yet"
            value={visibleProfile?.preferredCurrency ?? 'USD'}
            loading={preferenceSaving}
            onPress={() => setCurrencyPickerVisible(true)}
          />
          {preferenceMessage ? (
            <Text
              style={[
                styles.inlineMessage,
                preferenceMessage === 'Preferred currency updated.'
                  ? styles.success
                  : styles.error,
              ]}>
              {preferenceMessage}
            </Text>
          ) : null}
        </SettingsSection>

        <SettingsSection title="ACCOUNT">
          <SettingsRow
            icon="key-outline"
            title="Change Password"
            onPress={() => router.push('/(tabs)/profile/change-password')}
          />
          <SettingsDivider />
          <SettingsRow
            destructive
            icon="trash-outline"
            iconColor={PeakColors.error}
            iconBackground={PeakColors.errorLight}
            title="Delete Account"
            subtitle="Requires secure server-side deletion"
            onPress={confirmDeleteAccount}
          />
          <View style={styles.signOutWrap}>
            <PeakButton
              fullWidth
              loading={signingOut}
              title="Sign Out"
              variant="outline"
              onPress={confirmSignOut}
            />
            {signOutError ? (
              <Text style={[styles.inlineMessage, styles.error, styles.signOutError]}>
                {signOutError}
              </Text>
            ) : null}
          </View>
        </SettingsSection>

        <SettingsSection title="SUPPORT">
          <SettingsRow
            icon="help-circle-outline"
            title="Help & FAQ"
            onPress={() => showPlaceholder('Help & FAQ')}
          />
          <SettingsDivider />
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            iconColor={PeakColors.aqua}
            iconBackground={PeakColors.aquaLight}
            title="Send Feedback"
            onPress={() => showPlaceholder('Send Feedback')}
          />
          <SettingsDivider />
          <SettingsRow
            icon="warning-outline"
            iconColor={PeakColors.pink}
            iconBackground={PeakColors.pinkLight}
            title="Report a Problem"
            onPress={() => showPlaceholder('Report a Problem')}
          />
          <SettingsDivider />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            onPress={() => showPlaceholder('Privacy Policy')}
          />
          <SettingsDivider />
          <SettingsRow
            icon="document-text-outline"
            title="Terms of Service"
            onPress={() => showPlaceholder('Terms of Service')}
          />
        </SettingsSection>

        {errorMessage ? <Text style={[styles.pageMessage, styles.error]}>{errorMessage}</Text> : null}
        <Text style={styles.version}>Peak Settings v1</Text>
      </ScrollView>

      <CurrencyPickerModal
        visible={currencyPickerVisible}
        selected={visibleProfile?.preferredCurrency ?? 'USD'}
        onClose={() => setCurrencyPickerVisible(false)}
        onSelect={(currency) => void handleCurrencySelect(currency)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  heading: {
    marginBottom: Spacing.xs,
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
  profileSummary: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    ...Typography.h3,
  },
  profileEmail: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.primaryLight,
  },
  pressed: {
    opacity: 0.72,
  },
  inlineMessage: {
    ...Typography.caption,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  pageMessage: {
    ...Typography.bodySmall,
    textAlign: 'center',
  },
  success: {
    color: PeakColors.success,
  },
  error: {
    color: PeakColors.error,
  },
  version: {
    ...Typography.caption,
    color: PeakColors.textMuted,
    textAlign: 'center',
  },
  signOutWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: PeakColors.surface,
  },
  signOutError: {
    textAlign: 'center',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
});
