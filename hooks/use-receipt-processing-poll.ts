import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchReceiptProcessingJob } from '@/lib/receipt/receipt-api';
import { supabase } from '@/lib/supabase';
import type { ReceiptProcessingJob } from '@/types/database';

export type ProcessingStage =
  | 'uploading'
  | 'reading'
  | 'organizing'
  | 'checking'
  | 'complete'
  | 'failed'
  | 'timeout';

const POLL_MS = 2000;
const TIMEOUT_MS = 120_000;

function stageFromJob(job: ReceiptProcessingJob | null, expenseStatus: string | null): ProcessingStage {
  if (job?.status === 'failed' || expenseStatus === 'failed') return 'failed';
  if (job?.status === 'completed' || expenseStatus === 'needs_review') return 'complete';

  if (job?.status === 'processing') {
    if (!job.started_at) return 'reading';
    const elapsed = Date.now() - new Date(job.started_at).getTime();
    if (elapsed > 45_000) return 'checking';
    if (elapsed > 20_000) return 'organizing';
    return 'reading';
  }

  if (job?.status === 'queued') return 'reading';
  return 'uploading';
}

export function useReceiptProcessingPoll(expenseId: string | undefined) {
  const [job, setJob] = useState<ReceiptProcessingJob | null>(null);
  const [expenseStatus, setExpenseStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stage, setStage] = useState<ProcessingStage>('uploading');
  const startedAtRef = useRef(Date.now());

  const refresh = useCallback(async () => {
    if (!expenseId) return;

    const { data, error } = await fetchReceiptProcessingJob(expenseId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setJob(data);

    const { data: expense } = await supabase
      .from('expenses')
      .select('receipt_status, processing_error')
      .eq('id', expenseId)
      .maybeSingle();

    if (expense) {
      setExpenseStatus(expense.receipt_status);
      if (expense.processing_error) {
        setErrorMessage(expense.processing_error);
      }
    }

    setStage(stageFromJob(data, expense?.receipt_status ?? null));
  }, [expenseId]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!expenseId) return;
    if (stage === 'complete' || stage === 'failed' || stage === 'timeout') return;

    const timer = setInterval(() => {
      if (Date.now() - startedAtRef.current > TIMEOUT_MS) {
        setStage('timeout');
        return;
      }
      void refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [expenseId, refresh, stage]);

  useEffect(() => {
    if (stage === 'complete' || stage === 'failed' || stage === 'timeout') {
      return;
    }
    setStage(stageFromJob(job, expenseStatus));
  }, [job, expenseStatus, stage]);

  return {
    job,
    expenseStatus,
    stage,
    errorMessage,
    refresh,
    timedOut: stage === 'timeout',
    isComplete: stage === 'complete',
    isFailed: stage === 'failed' || stage === 'timeout',
  };
}
