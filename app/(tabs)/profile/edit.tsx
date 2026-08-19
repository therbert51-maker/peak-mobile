import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CurrencyPickerModal } from '@/components/settings/CurrencyPickerModal';
import { Avatar } from '@/components/ui/Avatar';
import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-provider';
import { useUserProfile } from '@/hooks/use-user-profile';
import {
  pickProfileAvatar,
  uploadProfileAvatar,
  type AvatarPickSource,
} from '@/lib/profile-avatar';
import { showPermissionSettingsAlert } from '@/lib/receipt/pick-image';
import {
  profileInitials,
  type SupportedCurrency,
} from '@/lib/user-profile';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const { profile, errorMessage: loadError, refresh, save } = useUserProfile(user?.id);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState<SupportedCurrency>('USD');
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!profile || !user?.id || profile.id !== user.id) return;
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setDisplayName(profile.displayName);
    setCurrency(profile.preferredCurrency);
  }, [profile, user?.id]);

  const handleSave = async () => {
    const hasName = Boolean(firstName.trim() || lastName.trim() || displayName.trim());
    if (!hasName) {
      setValidationError('Add a first name, last name, or display name.');
      return;
    }
    if (firstName.trim().length > 80 || lastName.trim().length > 80) {
      setValidationError('First and last names must be 80 characters or fewer.');
      return;
    }
    if (displayName.trim().length > 100) {
      setValidationError('Display name must be 100 characters or fewer.');
      return;
    }

    setValidationError(null);
    setSaveError(null);
    setSaving(true);
    const result = await save({
      firstName,
      lastName,
      displayName,
      preferredCurrency: currency,
    });
    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }

    Alert.alert('Profile updated', 'Your profile and preferences were saved.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  const handleAvatarPick = async (source: AvatarPickSource) => {
    if (!user?.id || uploadingAvatar) return;

    setSaveError(null);
    setUploadingAvatar(true);
    const picked = await pickProfileAvatar(source);

    if (picked.cancelled) {
      setUploadingAvatar(false);
      return;
    }
    if (picked.error || !picked.base64 || !picked.mimeType) {
      setUploadingAvatar(false);
      const message = picked.error ?? 'Could not read the selected photo.';
      if (message.includes('disabled in Settings')) {
        showPermissionSettingsAlert(message);
      } else {
        setSaveError(message);
      }
      return;
    }

    const result = await uploadProfileAvatar({
      userId: user.id,
      base64: picked.base64,
      mimeType: picked.mimeType,
    });
    setUploadingAvatar(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }

    await refresh();
    Alert.alert('Photo updated', 'Your new profile photo is ready.');
  };

  const chooseAvatarSource = () => {
    Alert.alert('Change profile photo', 'Choose a photo source.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: () => void handleAvatarPick('camera') },
      { text: 'Choose from Library', onPress: () => void handleAvatarPick('library') },
    ]);
  };

  const initials = profile
    ? profileInitials(
        { ...profile, firstName, lastName, displayName, preferredCurrency: currency },
        user?.email,
      )
    : 'P';
  const avatarSource = profile?.avatarUrl ? { uri: profile.avatarUrl } : undefined;

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
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.avatarCard}>
            <Avatar initials={initials} source={avatarSource} size="lg" />
            <View style={styles.avatarCopy}>
              <Text style={styles.avatarTitle}>Profile photo</Text>
              <Text style={styles.avatarNote}>
                JPEG, PNG, or WebP · 5 MB maximum
              </Text>
              <PeakButton
                loading={uploadingAvatar}
                title={profile?.avatarUrl ? 'Change Photo' : 'Add Photo'}
                variant="text"
                onPress={chooseAvatarSource}
                style={styles.avatarAction}
              />
            </View>
          </View>

          <View style={styles.form}>
            <PeakInput
              autoCapitalize="words"
              autoComplete="name-given"
              label="First name"
              maxLength={80}
              placeholder="First name"
              textContentType="givenName"
              value={firstName}
              onChangeText={(value) => {
                setFirstName(value);
                setValidationError(null);
              }}
            />
            <PeakInput
              autoCapitalize="words"
              autoComplete="name-family"
              label="Last name"
              maxLength={80}
              placeholder="Last name"
              textContentType="familyName"
              value={lastName}
              onChangeText={(value) => {
                setLastName(value);
                setValidationError(null);
              }}
            />
            <PeakInput
              autoCapitalize="words"
              label="Display name"
              maxLength={100}
              placeholder="How others see you"
              value={displayName}
              onChangeText={(value) => {
                setDisplayName(value);
                setValidationError(null);
              }}
            />

            <View style={styles.currencyField}>
              <Text style={styles.fieldLabel}>Preferred currency</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCurrencyPickerVisible(true)}
                style={({ pressed }) => [
                  styles.currencyButton,
                  pressed && styles.currencyPressed,
                ]}>
                <View style={styles.currencyIcon}>
                  <Ionicons name="cash-outline" size={20} color={PeakColors.primary} />
                </View>
                <Text style={styles.currencyValue}>{currency}</Text>
                <Ionicons name="chevron-forward" size={19} color={PeakColors.textMuted} />
              </Pressable>
              <Text style={styles.helper}>
                This preference does not convert existing expenses.
              </Text>
            </View>
          </View>

          {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
          {saveError || loadError ? (
            <Text style={styles.error}>{saveError ?? loadError}</Text>
          ) : null}

          <PeakButton
            fullWidth
            loading={saving}
            title="Save Profile"
            onPress={() => void handleSave()}
          />
        </ScrollView>

        <CurrencyPickerModal
          visible={currencyPickerVisible}
          selected={currency}
          onClose={() => setCurrencyPickerVisible(false)}
          onSelect={(value) => {
            setCurrency(value);
            setCurrencyPickerVisible(false);
          }}
        />
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
    backgroundColor: PeakColors.background,
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
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  avatarCopy: {
    flex: 1,
  },
  avatarTitle: {
    ...Typography.label,
  },
  avatarNote: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  avatarAction: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    marginLeft: -Spacing.sm,
  },
  form: {
    gap: Spacing.md,
  },
  currencyField: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.label,
  },
  currencyButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surface,
  },
  currencyPressed: {
    opacity: 0.74,
  },
  currencyIcon: {
    marginRight: Spacing.sm,
  },
  currencyValue: {
    ...Typography.body,
    flex: 1,
    fontWeight: '600',
  },
  helper: {
    ...Typography.caption,
  },
  error: {
    ...Typography.bodySmall,
    color: PeakColors.error,
    textAlign: 'center',
  },
});
