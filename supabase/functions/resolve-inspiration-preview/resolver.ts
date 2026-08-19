import {
  categorizeHttpStatus,
  categorizeOEmbedFailure,
  categorizeOpenGraphFailure,
  classifyInstagramHtml,
  followPublicHtmlRedirects,
  inspectOpenGraphPreview,
  parseOEmbedErrorDetails,
  sanitizeFailureReason,
  summarizeOEmbedPayload,
} from './instagram-diagnostics.ts';
import {
  fallbackPreview,
  parseHtmlPreview,
  parseInstagramOEmbedPreview,
  parseOEmbedPreview,
} from './metadata.ts';
import type { ResolvedPreview } from './types.ts';
import {
  assertPublicHostname,
  normalizeInspirationUrl,
  normalizeInstagramPostUrl,
  platformForUrl,
} from './url.ts';

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;
const INSTAGRAM_OEMBED_ENDPOINT = 'https://graph.facebook.com/v26.0/instagram_oembed';
const INSTAGRAM_OG_USER_AGENT =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) throw new Error('response_too_large');
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let output = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('response_too_large');
    }
    output += decoder.decode(value, { stream: true });
  }

  return output + decoder.decode();
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHtml(
  startUrl: URL,
  userAgent = 'PeakPreviewBot/1.0',
): Promise<{ html: string; finalUrl: string }> {
  let current = startUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicHostname(current.hostname);
    const response = await fetchWithTimeout(current.toString(), {
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'User-Agent': userAgent,
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error('redirect_failed');
      current = normalizeInspirationUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) throw new Error(`upstream_${response.status}`);
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('unsupported_content_type');
    }

    return {
      html: await readLimitedText(response, MAX_HTML_BYTES),
      finalUrl: current.toString(),
    };
  }

  throw new Error('redirect_failed');
}

async function fetchOEmbed(endpoint: URL): Promise<Record<string, unknown>> {
  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PeakPreviewBot/1.0',
    },
  });
  if (!response.ok) throw new Error(`oembed_${response.status}`);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('json')) throw new Error('invalid_oembed');
  const text = await readLimitedText(response, 128 * 1024);
  return JSON.parse(text) as Record<string, unknown>;
}

async function fetchInstagramOEmbed(endpoint: URL): Promise<{
  payload: Record<string, unknown>;
  status: number;
  contentType: string;
}> {
  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PeakPreviewBot/1.0',
    },
  });
  const status = response.status;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const text = await readLimitedText(response, 128 * 1024);

  if (!response.ok) {
    const errorDetails = parseOEmbedErrorDetails(text);
    const category = categorizeOEmbedFailure(status, errorDetails);
    console.warn('Instagram preview: oEmbed HTTP error', {
      status,
      contentType,
      category,
      errorCode: errorDetails.code,
      errorSubcode: errorDetails.subcode,
      errorMessage: errorDetails.message,
    });
    throw new Error(`oembed_${status}`);
  }

  if (!contentType.includes('json')) {
    console.warn('Instagram preview: oEmbed invalid content type', {
      status,
      contentType,
      category: 'invalid_content_type',
    });
    throw new Error('invalid_oembed');
  }

  return {
    payload: JSON.parse(text) as Record<string, unknown>,
    status,
    contentType,
  };
}

async function sanitizePreviewImage(preview: ResolvedPreview): Promise<ResolvedPreview> {
  if (!preview.imageUrl) return preview;
  try {
    await assertPublicHostname(new URL(preview.imageUrl).hostname);
    return preview;
  } catch {
    return { ...preview, imageUrl: null };
  }
}

async function resolveInstagramPreview(url: URL): Promise<ResolvedPreview> {
  const canonical = normalizeInstagramPostUrl(url);
  if (!canonical) {
    console.warn('Instagram preview: unsupported public post URL shape', {
      hostname: url.hostname,
      path: url.pathname,
    });
    const fallback = fallbackPreview(url);
    return { ...fallback, kind: 'website' };
  }

  const canonicalUrl = canonical.toString();
  let partial: ResolvedPreview | null = null;

  try {
    console.log('Instagram preview: attempting tokenless oEmbed', {
      path: canonical.pathname,
    });
    const endpoint = new URL(INSTAGRAM_OEMBED_ENDPOINT);
    endpoint.searchParams.set('url', canonicalUrl);
    endpoint.searchParams.set('omitscript', 'true');
    const oembed = await fetchInstagramOEmbed(endpoint);
    const payloadSummary = summarizeOEmbedPayload(oembed.payload);
    console.log('Instagram preview: oEmbed HTTP response', {
      path: canonical.pathname,
      status: oembed.status,
      contentType: oembed.contentType,
      ...payloadSummary,
    });

    partial = await sanitizePreviewImage(parseInstagramOEmbedPreview(oembed.payload, canonicalUrl));
    if (partial.imageUrl) {
      console.log('Instagram preview: oEmbed provided thumbnail', {
        path: canonical.pathname,
        status: oembed.status,
      });
      return { ...partial, normalizedUrl: canonicalUrl };
    }

    console.warn('Instagram preview: oEmbed returned no usable thumbnail', {
      path: canonical.pathname,
      status: oembed.status,
      contentType: oembed.contentType,
      category: 'oembed_thumbnail_omitted',
      hasTitle: Boolean(partial.title),
      hasProvider: Boolean(partial.source),
      hasAuthorField: payloadSummary.hasAuthorField,
      hasEmbedHtml: payloadSummary.hasEmbedHtml,
      embedHtmlLength: payloadSummary.embedHtmlLength,
      payloadKeys: payloadSummary.payloadKeys,
    });
  } catch (error) {
    console.warn('Instagram preview: tokenless oEmbed failed', {
      path: canonical.pathname,
      category: sanitizeFailureReason(error).startsWith('oembed_')
        ? categorizeHttpStatus(Number(sanitizeFailureReason(error).replace('oembed_', ''))) ??
          'network_error'
        : sanitizeFailureReason(error),
      reason: sanitizeFailureReason(error),
    });
  }

  try {
    console.log('Instagram preview: attempting Open Graph fallback', {
      path: canonical.pathname,
    });
    const page = await followPublicHtmlRedirects({
      startUrl: canonical,
      userAgent: INSTAGRAM_OG_USER_AGENT,
      fetchWithTimeout,
      readLimitedText,
      assertPublicHostname,
      maxRedirects: MAX_REDIRECTS,
      maxBytes: MAX_HTML_BYTES,
    });
    const { preview: openGraph, signals } = inspectOpenGraphPreview(page.html, page.finalUrl);
    console.log('Instagram preview: Open Graph HTTP response', {
      path: canonical.pathname,
      status: page.status,
      contentType: page.contentType,
      redirectCount: page.redirectCount,
      finalPath: new URL(page.finalUrl).pathname,
      pageKind: signals.pageKind,
      hasOgImage: signals.hasOgImage,
      hasOgTitle: signals.hasOgTitle,
      hasOgDescription: signals.hasOgDescription,
      hasOgVideo: signals.hasOgVideo,
    });

    const merged = await sanitizePreviewImage({
      normalizedUrl: canonicalUrl,
      title: openGraph.title || partial?.title || null,
      description: openGraph.description || partial?.description || null,
      imageUrl: openGraph.imageUrl,
      source: partial?.source || openGraph.source || 'Instagram',
      kind: canonical.pathname.includes('/reel')
        ? 'video'
        : openGraph.kind === 'website'
          ? 'image'
          : openGraph.kind,
    });
    if (merged.imageUrl) {
      console.log('Instagram preview: Open Graph fallback provided thumbnail', {
        path: canonical.pathname,
        status: page.status,
        pageKind: signals.pageKind,
      });
      return merged;
    }

    const category = categorizeOpenGraphFailure({
      signals,
      preview: merged,
      status: page.status,
      contentType: page.contentType,
      redirectCount: page.redirectCount,
    });
    console.warn('Instagram preview: Open Graph fallback returned no usable thumbnail', {
      path: canonical.pathname,
      status: page.status,
      contentType: page.contentType,
      redirectCount: page.redirectCount,
      category,
      pageKind: signals.pageKind,
      hasOgTitle: signals.hasOgTitle,
      hasOgDescription: signals.hasOgDescription,
      hasOgVideo: signals.hasOgVideo,
      hasTitle: Boolean(merged.title),
      hasDescription: Boolean(merged.description),
    });
  } catch (error) {
    const category = categorizeOpenGraphFailure({ error });
    console.warn('Instagram preview: Open Graph fallback failed', {
      path: canonical.pathname,
      category,
      reason: sanitizeFailureReason(error),
    });
  }

  if (partial) {
    console.warn('Instagram preview: returning metadata without thumbnail', {
      path: canonical.pathname,
    });
    return { ...partial, normalizedUrl: canonicalUrl };
  }

  const fallback = fallbackPreview(canonical);
  return {
    ...fallback,
    normalizedUrl: canonicalUrl,
    kind: canonical.pathname.includes('/reel') ? 'video' : 'image',
  };
}

async function resolveProviderPreview(url: URL): Promise<ResolvedPreview | null> {
  const platform = platformForUrl(url);
  if (platform === 'YouTube') {
    const endpoint = new URL('https://www.youtube.com/oembed');
    endpoint.searchParams.set('url', url.toString());
    endpoint.searchParams.set('format', 'json');
    const payload = await fetchOEmbed(endpoint);
    const preview = parseOEmbedPreview(payload, url.toString(), platform);
    const fallback = fallbackPreview(url);
    return { ...preview, imageUrl: preview.imageUrl || fallback.imageUrl };
  }

  if (platform === 'TikTok') {
    const endpoint = new URL('https://www.tiktok.com/oembed');
    endpoint.searchParams.set('url', url.toString());
    const payload = await fetchOEmbed(endpoint);
    return parseOEmbedPreview(payload, url.toString(), platform);
  }

  return null;
}

export async function resolveInspirationPreview(rawUrl: string): Promise<ResolvedPreview> {
  const normalized = normalizeInspirationUrl(rawUrl);
  await assertPublicHostname(normalized.hostname);

  if (platformForUrl(normalized) === 'Instagram') {
    return resolveInstagramPreview(normalized);
  }

  let preview: ResolvedPreview;
  try {
    const providerPreview = await resolveProviderPreview(normalized);
    if (providerPreview) {
      preview = providerPreview;
      if (preview.imageUrl) {
        try {
          await assertPublicHostname(new URL(preview.imageUrl).hostname);
        } catch {
          preview.imageUrl = null;
        }
      }
      return { ...preview, normalizedUrl: normalized.toString() };
    }
  } catch (error) {
    console.warn('Provider preview unavailable', {
      platform: platformForUrl(normalized),
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }

  try {
    const page = await fetchHtml(normalized);
    preview = parseHtmlPreview(page.html, page.finalUrl);
  } catch (error) {
    preview = fallbackPreview(normalized);
    if (!preview.imageUrl) throw error;
  }

  if (preview.imageUrl) {
    try {
      await assertPublicHostname(new URL(preview.imageUrl).hostname);
    } catch {
      preview.imageUrl = null;
    }
  }

  if (!preview.title && !preview.description && !preview.imageUrl) {
    const fallback = fallbackPreview(normalized);
    if (!fallback.imageUrl && fallback.source === preview.source) {
      throw new Error('metadata_unavailable');
    }
    preview = fallback;
  }

  return {
    ...preview,
    normalizedUrl: normalized.toString(),
  };
}
