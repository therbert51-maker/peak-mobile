import { FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export const RECEIPT_BUCKET = 'receipt-images';

const PARSE_RECEIPT_FUNCTION = 'parse-receipt';

export type InvokeParseReceiptResult = {
  ok: boolean;
  error: string | null;
};

export function buildReceiptStoragePath(userId: string, spaceId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${spaceId}/${safeName}`;
}

export function receiptFileName(): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `receipt-${id}.jpg`;
}

function decodeBase64Image(base64: string): ArrayBuffer {
  const payload = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').replace(/\s/g, '');
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function formatFunctionInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string; message?: string };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // fall through
    }
    return error.message || 'Receipt scanner request failed.';
  }

  if (error instanceof FunctionsRelayError) {
    return (
      error.message ||
      'Could not reach the receipt scanner. Confirm parse-receipt is deployed for this project.'
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Could not reach the receipt scanner.';
}

export async function markReceiptProcessingFailed(
  expenseId: string,
  message: string,
): Promise<{ ok: boolean; error: string | null }> {
  const safeMessage = message.trim() || 'Receipt scanning failed.';
  const completedAt = new Date().toISOString();

  const [jobResult, expenseResult] = await Promise.all([
    supabase
      .from('receipt_processing_jobs')
      .update({
        status: 'failed',
        error_message: safeMessage,
        completed_at: completedAt,
      })
      .eq('expense_id', expenseId),
    supabase
      .from('expenses')
      .update({
        receipt_status: 'failed',
        processing_error: safeMessage,
      })
      .eq('id', expenseId),
  ]);

  if (jobResult.error) {
    return { ok: false, error: jobResult.error.message };
  }
  if (expenseResult.error) {
    return { ok: false, error: expenseResult.error.message };
  }

  return { ok: true, error: null };
}

export async function uploadReceiptImage(input: {
  userId: string;
  spaceId: string;
  jpegBase64: string;
}): Promise<{ path: string | null; error: string | null }> {
  const fileName = receiptFileName();
  const path = buildReceiptStoragePath(input.userId, input.spaceId, fileName);
  const contentType = 'image/jpeg';

  try {
    const arrayBuffer = decodeBase64Image(input.jpegBase64);
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      return { path: null, error: 'The selected receipt is not a valid JPEG image.' };
    }

    console.log('[receipt-upload] Uploading normalized image', {
      path,
      mimeType: contentType,
      byteSize: bytes.length,
      transport: 'expo-picker-jpeg-base64-to-storage-bytes',
    });

    const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, arrayBuffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      return { path: null, error: error.message };
    }

    return { path, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed.';
    return { path: null, error: message };
  }
}

export async function createReceiptScanExpense(input: {
  spaceId: string;
  createdBy: string;
  paidBy: string;
  preferredDisplayCurrency: string;
  receiptImagePath: string;
}): Promise<{ expenseId: string | null; error: string | null }> {
  const display = input.preferredDisplayCurrency.toUpperCase();

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      space_id: input.spaceId,
      created_by: input.createdBy,
      paid_by: input.paidBy,
      expense_title: 'Receipt scan',
      total: 0,
      original_currency: display,
      display_currency: display,
      receipt_status: 'uploaded',
      receipt_image_path: input.receiptImagePath,
      tax: 0,
      tip: 0,
      fees: 0,
      discount: 0,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { expenseId: null, error: error?.message ?? 'Could not create expense.' };
  }

  return { expenseId: data.id, error: null };
}

export async function queueReceiptProcessingJob(input: {
  expenseId: string;
  requestedBy: string;
}): Promise<{ jobId: string | null; error: string | null }> {
  const existing = await supabase
    .from('receipt_processing_jobs')
    .select('id, status')
    .eq('expense_id', input.expenseId)
    .maybeSingle();

  if (existing.error) {
    return { jobId: null, error: existing.error.message };
  }

  if (existing.data?.id) {
    if (existing.data.status === 'failed') {
      const { error: resetError } = await supabase
        .from('receipt_processing_jobs')
        .update({
          status: 'queued',
          error_message: null,
          completed_at: null,
          started_at: null,
        })
        .eq('expense_id', input.expenseId);

      if (resetError) {
        return { jobId: null, error: resetError.message };
      }
    }

    return { jobId: existing.data.id, error: null };
  }

  const { data, error } = await supabase
    .from('receipt_processing_jobs')
    .insert({
      expense_id: input.expenseId,
      requested_by: input.requestedBy,
      status: 'queued',
    })
    .select('id')
    .single();

  if (error || !data) {
    return { jobId: null, error: error?.message ?? 'Could not queue receipt processing.' };
  }

  return { jobId: data.id, error: null };
}

export async function invokeParseReceipt(input: {
  expenseId: string;
  receiptPath: string;
  preferredCurrency: string;
}): Promise<InvokeParseReceiptResult> {
  const expenseId = input.expenseId.trim();
  const receiptPath = input.receiptPath.trim();
  const preferredCurrency = input.preferredCurrency.trim().toUpperCase();

  if (!expenseId || !receiptPath || !preferredCurrency) {
    const message = 'Missing expenseId, receiptPath, or preferredCurrency for parse-receipt.';
    console.error('[parse-receipt]', message, input);
    return { ok: false, error: message };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    const message = 'You must be signed in to scan receipts.';
    console.error('[parse-receipt] Missing session', sessionError?.message ?? 'no access token');
    return { ok: false, error: message };
  }

  const body = {
    expenseId,
    receiptPath,
    preferredCurrency,
  };

  console.log('[parse-receipt] Invoking edge function', {
    function: PARSE_RECEIPT_FUNCTION,
    expenseId,
    receiptPath,
    preferredCurrency,
  });

  const { data, error } = await supabase.functions.invoke(PARSE_RECEIPT_FUNCTION, {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    const message = await formatFunctionInvokeError(error);
    console.error('[parse-receipt] Invoke failed:', message, error);
    return { ok: false, error: message };
  }

  if (data === null || data === undefined) {
    const message =
      'Receipt scanner returned no response. Deploy parse-receipt to this Supabase project.';
    console.error('[parse-receipt] Null response body');
    return { ok: false, error: message };
  }

  if (typeof data === 'object' && 'error' in data && data.error) {
    const message = String(data.error);
    console.error('[parse-receipt] Function returned error:', message);
    return { ok: false, error: message };
  }

  if (typeof data !== 'object' || !('ok' in data) || data.ok !== true) {
    const message = 'Unexpected response from receipt scanner.';
    console.error('[parse-receipt] Unexpected response:', data);
    return { ok: false, error: message };
  }

  console.log('[parse-receipt] Invoke succeeded', data);
  return { ok: true, error: null };
}

export async function fetchReceiptProcessingJob(expenseId: string) {
  return supabase
    .from('receipt_processing_jobs')
    .select('*')
    .eq('expense_id', expenseId)
    .maybeSingle();
}

export async function fetchExpenseForReview(expenseId: string) {
  return supabase.from('expenses').select('*').eq('id', expenseId).single();
}

export async function fetchExpenseItems(expenseId: string) {
  return supabase
    .from('expense_items')
    .select('*')
    .eq('expense_id', expenseId)
    .order('sort_order', { ascending: true });
}

export async function signedReceiptImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function deleteExpenseAndReceipt(
  expenseId: string,
): Promise<{ ok: boolean; error: string | null; cleanupWarning: string | null }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: 'You must be signed in to delete an expense.',
      cleanupWarning: null,
    };
  }

  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('id, created_by, receipt_image_path')
    .eq('id', expenseId)
    .maybeSingle();

  if (fetchError || !expense) {
    return {
      ok: false,
      error: fetchError?.message ?? 'Expense not found or access denied.',
      cleanupWarning: null,
    };
  }

  if (expense.created_by !== user.id) {
    return {
      ok: false,
      error: 'Only the person who created this expense can delete it.',
      cleanupWarning: null,
    };
  }

  const { data: deleted, error: deleteError } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('created_by', user.id)
    .select('id')
    .maybeSingle();

  if (deleteError || !deleted) {
    return {
      ok: false,
      error: deleteError?.message ?? 'You do not have permission to delete this expense.',
      cleanupWarning: null,
    };
  }

  if (!expense.receipt_image_path) {
    return { ok: true, error: null, cleanupWarning: null };
  }

  const { error: storageError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .remove([expense.receipt_image_path]);

  if (storageError) {
    console.error('[expense-delete] Receipt image cleanup failed', {
      expenseId,
      receiptPath: expense.receipt_image_path,
      message: storageError.message,
    });
    return {
      ok: true,
      error: null,
      cleanupWarning: 'The expense was deleted, but its receipt image could not be cleaned up.',
    };
  }

  return { ok: true, error: null, cleanupWarning: null };
}
