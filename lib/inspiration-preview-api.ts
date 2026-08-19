import { FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import { notifyInspirationSaved } from '@/lib/inspiration-refresh';
import { supabase } from '@/lib/supabase';

const PREVIEW_FUNCTION = 'resolve-inspiration-preview';
const POLL_DELAYS_MS = [1200, 1800, 2600, 3600];

async function functionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string; message?: string };
      if (body.error) return body.error;
      if (body.message) return body.message;
    } catch {
      // Fall through to the transport message.
    }
  }
  if (error instanceof FunctionsRelayError) {
    return (
      error.message ||
      'Could not reach link preview resolver. Confirm resolve-inspiration-preview is deployed.'
    );
  }
  if (error instanceof Error) return error.message;
  return 'Could not start link preview resolution.';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notifyWhenPreviewSettles(
  inspirationId: string,
  spaceId: string,
): Promise<void> {
  for (const waitMs of POLL_DELAYS_MS) {
    await delay(waitMs);
    const { data, error } = await supabase
      .from('inspiration')
      .select('preview_status')
      .eq('id', inspirationId)
      .maybeSingle();

    if (error || !data) return;
    if (data.preview_status !== 'pending' && data.preview_status !== 'processing') {
      notifyInspirationSaved(spaceId);
      return;
    }
  }
}

export async function requestInspirationPreview(input: {
  inspirationId: string;
  spaceId: string;
  url?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  const inspirationId = input.inspirationId.trim();
  const spaceId = input.spaceId.trim();

  if (!inspirationId || !spaceId) {
    return { ok: false, error: 'Missing inspirationId or spaceId for preview resolution.' };
  }

  let trimmedUrl = input.url?.trim() ?? '';
  if (!trimmedUrl) {
    const { data: row } = await supabase
      .from('inspiration')
      .select('url')
      .eq('id', inspirationId)
      .maybeSingle();
    trimmedUrl = row?.url?.trim() ?? '';
  }

  if (!trimmedUrl) {
    return { ok: false, error: 'No URL to preview.' };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) {
    return { ok: false, error: sessionError?.message ?? 'You must be signed in.' };
  }

  const { data, error } = await supabase.functions.invoke(PREVIEW_FUNCTION, {
    body: { inspirationId },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    return { ok: false, error: await functionErrorMessage(error) };
  }

  if (data === null || data === undefined) {
    return {
      ok: false,
      error:
        'Link preview resolver returned no response. Deploy resolve-inspiration-preview to this Supabase project.',
    };
  }

  if (typeof data === 'object' && 'error' in data && data.error) {
    return { ok: false, error: String(data.error) };
  }

  if (typeof data !== 'object' || !('ok' in data) || data.ok !== true) {
    return { ok: false, error: 'Unexpected response from link preview resolver.' };
  }

  void notifyWhenPreviewSettles(inspirationId, spaceId);
  return { ok: true, error: null };
}

export function requestInspirationPreviewNonBlocking(input: {
  inspirationId: string;
  spaceId: string;
  url?: string | null;
}): void {
  void requestInspirationPreview(input).then((result) => {
    if (!result.ok) {
      console.warn('[inspiration-preview]', result.error);
    }
  });
}
