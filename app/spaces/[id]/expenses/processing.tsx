import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeakButton } from '@/components/ui/PeakButton';
import { PeakColors } from '@/constants/colors';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useReceiptProcessingPoll, type ProcessingStage } from '@/hooks/use-receipt-processing-poll';
import {
  invokeParseReceipt,
  markReceiptProcessingFailed,
} from '@/lib/receipt/receipt-api';
import { supabase } from '@/lib/supabase';

const STAGE_COPY: Record<ProcessingStage, string> = {
  uploading: 'Uploading receipt',
  reading: 'Reading receipt',
  organizing: 'Organizing items',
  checking: 'Checking totals',
  complete: 'Ready for review',
  failed: 'Scan failed',
  timeout: 'Timed out',
};

function StageRow({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <View style={styles.stageRow}>
      <View style={[styles.stageDot, done && styles.stageDotDone, active && styles.stageDotActive]} />
      <Text style={[styles.stageLabel, active && styles.stageLabelActive]}>{label}</Text>
    </View>
  );
}

export default function ReceiptProcessingScreen() {
  const { id, expenseId } = useLocalSearchParams<{
    id: string;
    expenseId: string;
  }>();
  const spaceId = Array.isArray(id) ? id[0] : id;
  const expenseIdValue = Array.isArray(expenseId) ? expenseId[0] : expenseId;

  const { stage, errorMessage, isComplete, isFailed, refresh, job, timedOut } =
    useReceiptProcessingPoll(expenseIdValue);

  const [invokeError, setInvokeError] = useState<string | null>(null);
  const [invoking, setInvoking] = useState(false);
  const invokeAttempted = useRef(false);

  const runParseReceipt = useCallback(async () => {
    if (!expenseIdValue) return;

    setInvoking(true);
    setInvokeError(null);

    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .select('receipt_image_path, display_currency')
      .eq('id', expenseIdValue)
      .maybeSingle();

    if (expenseError || !expense?.receipt_image_path) {
      const message =
        expenseError?.message ?? 'Receipt image is missing. Try scanning again or enter manually.';
      console.error('[parse-receipt] Cannot invoke — missing receipt path', expenseError?.message);
      setInvokeError(message);
      await markReceiptProcessingFailed(expenseIdValue, message);
      await refresh();
      setInvoking(false);
      return;
    }

    const result = await invokeParseReceipt({
      expenseId: expenseIdValue,
      receiptPath: expense.receipt_image_path,
      preferredCurrency: expense.display_currency ?? 'USD',
    });

    if (!result.ok) {
      const message = result.error ?? 'Receipt scanning failed.';
      setInvokeError(message);
      await markReceiptProcessingFailed(expenseIdValue, message);
    }

    await refresh();
    setInvoking(false);
  }, [expenseIdValue, refresh]);

  useEffect(() => {
    if (!expenseIdValue || !job) return;
    if (job.status !== 'queued') return;
    if (invokeAttempted.current) return;

    invokeAttempted.current = true;
    void runParseReceipt();
  }, [expenseIdValue, job, runParseReceipt]);

  useEffect(() => {
    if (!timedOut || !expenseIdValue) return;
    if (job?.status === 'completed' || job?.status === 'failed') return;

    void (async () => {
      const message = 'Receipt reading timed out. Please try again or enter the expense manually.';
      setInvokeError(message);
      await markReceiptProcessingFailed(expenseIdValue, message);
      await refresh();
    })();
  }, [timedOut, expenseIdValue, job?.status, refresh]);

  useEffect(() => {
    if (isComplete && spaceId && expenseIdValue) {
      router.replace({
        pathname: '/spaces/[id]/expenses/[expenseId]/review',
        params: { id: spaceId, expenseId: expenseIdValue },
      });
    }
  }, [isComplete, expenseIdValue, spaceId]);

  const retry = async () => {
    if (!expenseIdValue) return;

    invokeAttempted.current = false;

    const { error: resetError } = await supabase
      .from('receipt_processing_jobs')
      .update({
        status: 'queued',
        error_message: null,
        completed_at: null,
        started_at: null,
      })
      .eq('expense_id', expenseIdValue);

    if (resetError) {
      setInvokeError(resetError.message);
      return;
    }

    await refresh();
    invokeAttempted.current = true;
    await runParseReceipt();
  };

  const displayError = invokeError ?? errorMessage ?? job?.error_message ?? null;
  const showFailure = isFailed || Boolean(displayError && !invoking);

  const ordered: ProcessingStage[] = ['uploading', 'reading', 'organizing', 'checking'];
  const currentIndex = ordered.indexOf(
    stage === 'complete' ? 'checking' : stage === 'failed' || stage === 'timeout' ? 'reading' : stage,
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={PeakColors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Reading receipt</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.body}>
        {!showFailure ? (
          <>
            <ActivityIndicator size="large" color={PeakColors.primary} style={styles.spinner} />
            <Text style={styles.headline}>
              {invoking || job?.status === 'queued' ? 'Starting receipt scan…' : STAGE_COPY[stage]}
            </Text>
            <Text style={styles.sub}>Peak AI is extracting merchant, items, and totals.</Text>

            <View style={styles.stageList}>
              {ordered.map((key, index) => (
                <StageRow
                  key={key}
                  label={STAGE_COPY[key]}
                  active={index === currentIndex}
                  done={index < currentIndex || stage === 'complete'}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle-outline" size={56} color={PeakColors.error} />
            <Text style={styles.headline}>
              {stage === 'timeout' ? 'This is taking too long' : 'Could not read receipt'}
            </Text>
            <Text style={styles.sub}>
              {displayError ??
                'Try again with a clearer photo, or enter the expense manually.'}
            </Text>
            <PeakButton title="Retry scan" onPress={retry} style={styles.action} />
            <PeakButton
              title="Review / edit manually"
              variant="outline"
              onPress={() =>
                router.replace({
                  pathname: '/spaces/[id]/expenses/[expenseId]/review',
                  params: { id: spaceId!, expenseId: expenseIdValue! },
                })
              }
            />
            <PeakButton title="Back to expenses" variant="text" onPress={() => router.back()} />
          </>
        )}
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
  title: { ...Typography.h3, flex: 1, textAlign: 'center' },
  spacer: { width: 26 },
  body: { flex: 1, padding: Spacing.xl, alignItems: 'center', justifyContent: 'center' },
  spinner: { marginBottom: Spacing.lg },
  headline: { ...Typography.h2, textAlign: 'center', marginTop: Spacing.md },
  sub: { ...Typography.bodySmall, textAlign: 'center', color: PeakColors.textSecondary, marginTop: Spacing.sm },
  stageList: {
    marginTop: Spacing.xl,
    alignSelf: 'stretch',
    padding: Spacing.lg,
    borderRadius: BorderRadius.large,
    backgroundColor: PeakColors.surface,
    borderWidth: 1,
    borderColor: PeakColors.border,
    gap: Spacing.md,
  },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PeakColors.borderStrong,
  },
  stageDotActive: { backgroundColor: PeakColors.primary },
  stageDotDone: { backgroundColor: PeakColors.aqua },
  stageLabel: { ...Typography.bodySmall, color: PeakColors.textMuted },
  stageLabelActive: { color: PeakColors.textPrimary, fontWeight: '700' },
  action: { marginTop: Spacing.lg, alignSelf: 'stretch' },
});
