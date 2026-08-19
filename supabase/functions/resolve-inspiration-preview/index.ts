import { createClient } from 'npm:@supabase/supabase-js@2';

import { resolveInspirationPreview } from './resolver.ts';
import type { InspirationPreviewRow } from './types.ts';
import { normalizeInspirationUrl, platformForUrl } from './url.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Preview service is unavailable.' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);
  const jwt = authHeader.replace('Bearer ', '');
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(jwt);
  if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

  let body: { inspirationId?: string };
  try {
    body = (await req.json()) as { inspirationId?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const inspirationId = body.inspirationId?.trim();
  if (!inspirationId) return jsonResponse({ error: 'Missing inspirationId' }, 400);

  console.log('resolve-inspiration-preview: request received', { inspirationId });

  const { data, error } = await userClient
    .from('inspiration')
    .select(
      'id, url, created_by, normalized_url, preview_status, preview_fetched_at',
    )
    .eq('id', inspirationId)
    .maybeSingle();

  if (error || !data) {
    console.warn('resolve-inspiration-preview: inspiration lookup failed', {
      inspirationId,
      reason: error?.message ?? 'not_found',
    });
    return jsonResponse({ error: 'Inspiration not found or access denied' }, 403);
  }

  const row = data as InspirationPreviewRow;
  if (row.created_by !== user.id) {
    console.warn('resolve-inspiration-preview: creator mismatch', { inspirationId });
    return jsonResponse({ error: 'Only the creator can resolve this preview' }, 403);
  }

  if (!row.url?.trim()) {
    console.log('resolve-inspiration-preview: skipping empty URL', { inspirationId });
    await userClient
      .from('inspiration')
      .update({ preview_status: 'skipped', preview_fetched_at: new Date().toISOString() })
      .eq('id', inspirationId);
    return jsonResponse({ ok: true, status: 'skipped' });
  }

  let normalizedUrl: string;
  let detectedProvider: string | null = null;
  try {
    const normalized = normalizeInspirationUrl(row.url);
    normalizedUrl = normalized.toString();
    detectedProvider = platformForUrl(normalized);
  } catch (normalizeError) {
    console.warn('resolve-inspiration-preview: URL normalization failed', {
      inspirationId,
      reason: normalizeError instanceof Error ? normalizeError.message : 'unknown',
    });
    await userClient
      .from('inspiration')
      .update({
        normalized_url: null,
        preview_status: 'failed',
        preview_fetched_at: new Date().toISOString(),
      })
      .eq('id', inspirationId);
    return jsonResponse({ ok: true, status: 'failed' });
  }

  if (row.preview_status === 'ready' && row.normalized_url === normalizedUrl) {
    console.log('resolve-inspiration-preview: cached ready preview', {
      inspirationId,
      provider: detectedProvider,
    });
    return jsonResponse({ ok: true, status: 'ready', cached: true });
  }

  const processingSince = row.preview_fetched_at
    ? new Date(row.preview_fetched_at).getTime()
    : 0;
  const processingIsFresh =
    row.preview_status === 'processing' &&
    row.normalized_url === normalizedUrl &&
    Date.now() - processingSince < 5 * 60 * 1000;
  if (processingIsFresh) {
    console.log('resolve-inspiration-preview: fresh processing lock', {
      inspirationId,
      provider: detectedProvider,
    });
    return jsonResponse({ ok: true, status: 'processing', cached: true }, 202);
  }

  const claimedAt = new Date().toISOString();
  let claim = userClient
    .from('inspiration')
    .update({
      normalized_url: normalizedUrl,
      preview_title: null,
      preview_description: null,
      preview_image_url: null,
      preview_source: null,
      preview_kind: null,
      preview_status: 'processing',
      preview_fetched_at: claimedAt,
    })
    .eq('id', inspirationId)
    .eq('preview_status', row.preview_status);

  if (row.normalized_url === null) {
    claim = claim.is('normalized_url', null);
  } else {
    claim = claim.eq('normalized_url', row.normalized_url);
  }

  const { data: claimed, error: claimError } = await claim.select('id').maybeSingle();
  if (claimError) {
    console.error('Could not claim inspiration preview', claimError.message);
    return jsonResponse({ error: 'Could not start preview resolution.' }, 500);
  }
  if (!claimed) {
    console.log('resolve-inspiration-preview: preview already claimed elsewhere', {
      inspirationId,
      provider: detectedProvider,
      previewStatus: row.preview_status,
    });
    return jsonResponse({ ok: true, status: 'processing', cached: true }, 202);
  }

  console.log('resolve-inspiration-preview: starting background resolve', {
    inspirationId,
    provider: detectedProvider,
    previewStatus: row.preview_status,
  });

  EdgeRuntime.waitUntil(
    (async () => {
      try {
        const preview = await resolveInspirationPreview(row.url!);
        const { error: updateError } = await userClient
          .from('inspiration')
          .update({
            normalized_url: preview.normalizedUrl,
            preview_title: preview.title,
            preview_description: preview.description,
            preview_image_url: preview.imageUrl,
            preview_source: preview.source,
            preview_kind: preview.kind,
            preview_status: 'ready',
            preview_fetched_at: new Date().toISOString(),
          })
          .eq('id', inspirationId)
          .eq('normalized_url', normalizedUrl)
          .eq('preview_status', 'processing');

        if (updateError) throw updateError;
      } catch (previewError) {
        console.warn('Inspiration preview resolution failed', {
          inspirationId,
          reason: previewError instanceof Error ? previewError.message : 'unknown',
        });
        await userClient
          .from('inspiration')
          .update({
            preview_status: 'failed',
            preview_fetched_at: new Date().toISOString(),
          })
          .eq('id', inspirationId)
          .eq('normalized_url', normalizedUrl)
          .eq('preview_status', 'processing');
      }
    })(),
  );

  return jsonResponse({ ok: true, status: 'processing' }, 202);
});
