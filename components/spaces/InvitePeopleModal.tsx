import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakInput } from '@/components/ui/PeakInput';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import {
  buildSpaceInviteLink,
  createSpaceInvite,
  effectiveInviteStatus,
  fetchManagedSpaceInvites,
  revokeSpaceInvite,
  type ManagedSpaceInvite,
} from '@/lib/space-invites';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Expiration unavailable';
  return `Expires ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

export function InvitePeopleModal({
  spaceId,
  spaceName,
  visible,
  onClose,
}: {
  spaceId: string;
  spaceName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invites, setInvites] = useState<ManagedSpaceInvite[]>([]);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => effectiveInviteStatus(invite) === 'pending'),
    [invites],
  );

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const result = await fetchManagedSpaceInvites(spaceId);
    setLoading(false);
    if (result.error || !result.data) {
      setErrorMessage(result.error ?? 'Could not load pending invitations.');
      return;
    }
    setInvites(result.data);
  }, [spaceId]);

  useEffect(() => {
    if (visible) {
      void loadInvites();
    } else {
      setEmail('');
      setEmailError(null);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [loadInvites, visible]);

  const copyLink = async (invite: Pick<ManagedSpaceInvite, 'token' | 'invited_email'>) => {
    await Clipboard.setStringAsync(buildSpaceInviteLink(invite.token));
    setSuccessMessage(`Invite link copied for ${invite.invited_email}.`);
  };

  const shareInvite = async (
    invite: Pick<ManagedSpaceInvite, 'token' | 'invited_email'>,
  ) => {
    const link = buildSpaceInviteLink(invite.token);
    await Share.share({
      title: `Join ${spaceName} on Peak`,
      message: `You’re invited to join ${spaceName} on Peak.\n\n${link}`,
      url: link,
    });
  };

  const handleCreate = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setEmailError(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCreating(true);
    const result = await createSpaceInvite(spaceId, normalizedEmail);
    setCreating(false);
    if (result.error || !result.data) {
      setErrorMessage(result.error ?? 'Could not create this invitation.');
      return;
    }

    setEmail('');
    setSuccessMessage(`Invitation ready for ${result.data.invited_email}.`);
    await loadInvites();
  };

  const confirmRevoke = (invite: ManagedSpaceInvite) => {
    Alert.alert(
      'Revoke invitation?',
      `${invite.invited_email} will no longer be able to use this link.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setErrorMessage(null);
              const result = await revokeSpaceInvite(invite.id);
              if (result.error) {
                setErrorMessage(result.error);
                return;
              }
              await loadInvites();
            })();
          },
        },
      ],
    );
  };

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={visible}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Invite people</Text>
            <Text style={styles.subtitle}>{spaceName}</Text>
          </View>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
            <Ionicons name="close" size={28} color={PeakColors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.createCard}>
            <PeakInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              error={emailError ?? undefined}
              keyboardType="email-address"
              label="Email address"
              placeholder="friend@example.com"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (emailError) setEmailError(null);
              }}
            />
            <PeakButton
              fullWidth
              loading={creating}
              title="Create Invite Link"
              onPress={handleCreate}
              style={styles.createButton}
            />
            <Text style={styles.hint}>
              Peak will create a secure, email-specific link. Email delivery can be added later.
            </Text>
          </View>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}

          <Text style={styles.sectionTitle}>Pending invites</Text>
          {loading ? (
            <ActivityIndicator color={PeakColors.primary} style={styles.loader} />
          ) : pendingInvites.length === 0 ? (
            <Text style={styles.empty}>No pending invitations.</Text>
          ) : (
            <View style={styles.inviteList}>
              {pendingInvites.map((invite) => (
                <View key={invite.id} style={styles.inviteRow}>
                  <View style={styles.inviteIcon}>
                    <Ionicons name="mail-outline" size={20} color={PeakColors.primary} />
                  </View>
                  <View style={styles.inviteCopy}>
                    <Text style={styles.inviteEmail} numberOfLines={1}>
                      {invite.invited_email}
                    </Text>
                    <Text style={styles.inviteExpiry}>{formatExpiry(invite.expires_at)}</Text>
                    <View style={styles.rowActions}>
                      <Pressable hitSlop={8} onPress={() => copyLink(invite)}>
                        <Text style={styles.actionLink}>Copy link</Text>
                      </Pressable>
                      <Pressable hitSlop={8} onPress={() => shareInvite(invite)}>
                        <Text style={styles.actionLink}>Share</Text>
                      </Pressable>
                      <Pressable hitSlop={8} onPress={() => confirmRevoke(invite)}>
                        <Text style={styles.revokeLink}>Revoke</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PeakColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PeakColors.border,
  },
  title: {
    ...Typography.h2,
  },
  subtitle: {
    ...Typography.caption,
    color: PeakColors.textSecondary,
    marginTop: 2,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  createCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.large,
    backgroundColor: PeakColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
  },
  createButton: {
    marginTop: Spacing.md,
  },
  hint: {
    ...Typography.caption,
    color: PeakColors.textMuted,
    marginTop: Spacing.sm,
    textAlign: 'center',
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
  sectionTitle: {
    ...Typography.h3,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  loader: {
    marginTop: Spacing.lg,
  },
  empty: {
    ...Typography.bodySmall,
    color: PeakColors.textMuted,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
  inviteList: {
    gap: Spacing.sm,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    backgroundColor: PeakColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PeakColors.border,
  },
  inviteIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PeakColors.primaryLight,
  },
  inviteCopy: {
    flex: 1,
  },
  inviteEmail: {
    ...Typography.label,
  },
  inviteExpiry: {
    ...Typography.caption,
    color: PeakColors.textMuted,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  actionLink: {
    ...Typography.caption,
    color: PeakColors.primary,
    fontWeight: '700',
  },
  revokeLink: {
    ...Typography.caption,
    color: PeakColors.error,
    fontWeight: '700',
  },
});

