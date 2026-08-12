import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { useAuth } from '@/contexts/auth-provider';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { DEFAULT_EXPENSE_CURRENCY, EXPENSE_CURRENCY_OPTIONS } from '@/lib/expenses';
import { pickReceiptImage, showPermissionSettingsAlert, type ReceiptImagePickSource } from '@/lib/receipt/pick-image';
import {
  createReceiptScanExpense,
  queueReceiptProcessingJob,
  uploadReceiptImage,
} from '@/lib/receipt/receipt-api';
import { useTripMembers } from '@/hooks/use-trip-members';
import { tripMemberDisplayName, tripMemberInitials } from '@/lib/trip-members';
import { supabase } from '@/lib/supabase';

export default function ReceiptScanScreen() {
  const { user } = useAuth();
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const spaceId = Array.isArray(id) ? id[0] : id;
  const pickSource: ReceiptImagePickSource = source === 'library' ? 'library' : 'camera';

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const { members, loadState: membersLoadState } = useTripMembers(spaceId, ownerId);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [paidByUserId, setPaidByUserId] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState(DEFAULT_EXPENSE_CURRENCY);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stageLabel, setStageLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceId) return;
    void supabase
      .from('spaces')
      .select('owner_id')
      .eq('id', spaceId)
      .maybeSingle()
      .then(({ data }) => setOwnerId(data?.owner_id ?? null));
  }, [spaceId]);

  useEffect(() => {
    if (paidByUserId || members.length === 0) return;
    setPaidByUserId(user?.id ?? members[0]?.userId ?? null);
  }, [members, paidByUserId, user?.id]);

  const pickImage = useCallback(async () => {
    setErrorMessage(null);
    const result = await pickReceiptImage(pickSource);
    if (result.error) {
      setErrorMessage(result.error);
      if (result.error.includes('Settings')) {
        showPermissionSettingsAlert(result.error);
      }
      return;
    }
    if (result.cancelled) return;
    if (result.uri) setImageUri(result.uri);
  }, [pickSource]);

  useEffect(() => {
    void pickImage();
  }, [pickImage]);

  const handleRetake = async () => {
    setImageUri(null);
    await pickImage();
  };

  const startScan = async () => {
    if (!spaceId || !user?.id || !imageUri || !paidByUserId) {
      setErrorMessage('Choose who paid and add a receipt photo before continuing.');
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setStageLabel('Uploading receipt…');

    const upload = await uploadReceiptImage({
      userId: user.id,
      spaceId,
      localUri: imageUri,
    });

    if (!upload.path) {
      setBusy(false);
      setStageLabel(null);
      setErrorMessage(upload.error ?? 'Upload failed.');
      return;
    }

    const created = await createReceiptScanExpense({
      spaceId,
      createdBy: user.id,
      paidBy: paidByUserId,
      preferredDisplayCurrency: displayCurrency,
      receiptImagePath: upload.path,
    });

    if (!created.expenseId) {
      setBusy(false);
      setStageLabel(null);
      setErrorMessage(created.error ?? 'Could not create expense.');
      return;
    }

    const queued = await queueReceiptProcessingJob({
      expenseId: created.expenseId,
      requestedBy: user.id,
    });

    if (!queued.jobId) {
      setBusy(false);
      setStageLabel(null);
      setErrorMessage(queued.error ?? 'Could not queue processing.');
      return;
    }

    setBusy(false);
    setStageLabel(null);

    router.replace({
      pathname: '/spaces/[id]/expenses/processing',
      params: { id: spaceId, expenseId: created.expenseId },
    });
  };

  const goManual = () => {
    Alert.alert(
      'Enter manually instead?',
      'You can add this expense by hand if scanning is not working.',
      [
        { text: 'Stay here', style: 'cancel' },
        {
          text: 'Manual entry',
          onPress: () => router.back(),
        },
      ],
    );
  };

  if (!spaceId) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={PeakColors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Scan receipt</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.previewWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />
          ) : (
            <View style={styles.previewPlaceholder}>
              {membersLoadState === 'loading' ? (
                <ActivityIndicator color={PeakColors.primary} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={40} color={PeakColors.textMuted} />
                  <Text style={styles.previewHint}>No image selected</Text>
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.previewActions}>
          <PeakButton title="Retake / replace" variant="secondary" onPress={handleRetake} disabled={busy} />
        </View>

        <Text style={styles.fieldLabel}>Preferred display currency</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.currencyRow}>
          {EXPENSE_CURRENCY_OPTIONS.map((code) => {
            const selected = displayCurrency === code;
            return (
              <Pressable
                key={code}
                onPress={() => setDisplayCurrency(code)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{code}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.currencyNote}>Live conversion comes in a future update — no fake rates.</Text>

        <Text style={styles.fieldLabel}>Paid by</Text>
        {members.map((member) => {
          const selected = paidByUserId === member.userId;
          return (
            <Pressable
              key={member.userId}
              onPress={() => setPaidByUserId(member.userId)}
              style={[styles.memberRow, selected && styles.memberRowSelected]}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{tripMemberInitials(member)}</Text>
              </View>
              <Text style={styles.memberName}>{tripMemberDisplayName(member)}</Text>
              {selected ? (
                <Ionicons name="checkmark-circle" size={22} color={PeakColors.primary} />
              ) : null}
            </Pressable>
          );
        })}

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {stageLabel ? <Text style={styles.stage}>{stageLabel}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <PeakButton
          fullWidth
          loading={busy}
          title="Scan receipt"
          disabled={!imageUri || !paidByUserId || busy}
          onPress={startScan}
        />
        <PeakButton fullWidth variant="text" title="Enter manually instead" onPress={goManual} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PeakColors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  topTitle: { ...Typography.h3, flex: 1, textAlign: 'center' },
  spacer: { width: 24 },
  scroll: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  previewWrap: {
    borderRadius: BorderRadius.large,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PeakColors.border,
    backgroundColor: PeakColors.surfaceMuted,
    height: 280,
  },
  preview: { width: '100%', height: '100%' },
  previewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  previewHint: { ...Typography.bodySmall, color: PeakColors.textMuted },
  previewActions: { alignItems: 'flex-start' },
  fieldLabel: { ...Typography.label },
  currencyRow: { gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
  },
  chipSelected: { borderColor: PeakColors.primary, backgroundColor: PeakColors.primaryLight },
  chipText: { ...Typography.label, color: PeakColors.textSecondary },
  chipTextSelected: { color: PeakColors.primaryDark },
  currencyNote: { ...Typography.caption, color: PeakColors.textMuted },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.medium,
    borderWidth: 1.5,
    borderColor: PeakColors.border,
  },
  memberRowSelected: { borderColor: PeakColors.primary, backgroundColor: PeakColors.primaryLight },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.pill,
    backgroundColor: PeakColors.aquaLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: { ...Typography.caption, fontWeight: '800' },
  memberName: { ...Typography.label, flex: 1 },
  error: { ...Typography.bodySmall, color: PeakColors.error },
  stage: { ...Typography.bodySmall, color: PeakColors.primary },
  footer: { padding: Spacing.lg, gap: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: PeakColors.border },
});
