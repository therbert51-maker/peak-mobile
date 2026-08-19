import { parseHtmlPreview } from './metadata.ts';
import type { ResolvedPreview } from './types.ts';
import { normalizeInspirationUrl } from './url.ts';

export type InstagramFailureCategory =
  | 'auth_error'
  | 'rate_limited'
  | 'client_error'
  | 'server_error'
  | 'redirect_failed'
  | 'invalid_content_type'
  | 'response_too_large'
  | 'timeout'
  | 'blocked_host'
  | 'login_page'
  | 'challenge_page'
  | 'missing_og_image'
  | 'oembed_thumbnail_omitted'
  | 'oembed_not_embeddable'
  | 'network_error'
  | 'unknown';

export type InstagramHtmlSignals = {
  pageKind: 'login_page' | 'challenge_page' | 'metadata_page' | 'unknown';
  hasOgImage: boolean;
  hasOgTitle: boolean;
  hasOgDescription: boolean;
  hasOgVideo: boolean;
};

export function categorizeHttpStatus(status: number): InstagramFailureCategory | null {
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 429) return 'rate_limited';
  if (status >= 400 && status < 500) return 'client_error';
  if (status >= 500) return 'server_error';
  return null;
}

export function sanitizeFailureReason(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown';
  const message = error.message.trim();
  if (message === 'The operation was aborted' || message.includes('aborted')) return 'timeout';
  if (message.startsWith('upstream_')) return message;
  if (message.startsWith('oembed_')) return message;
  return message.slice(0, 120);
}

export function classifyInstagramHtml(html: string): InstagramHtmlSignals {
  const sample = html.slice(0, 20000).toLowerCase();
  const pageKind =
    sample.includes('log in to instagram') || sample.includes('loginform')
      ? 'login_page'
      : sample.includes('challenge_required') ||
          (sample.includes('/challenge/') && sample.includes('instagram'))
        ? 'challenge_page'
        : sample.includes('property="og:') || sample.includes("property='og:")
          ? 'metadata_page'
          : 'unknown';

  return {
    pageKind,
    hasOgImage: /property=["']og:image(?:[:\w-]*)?["']/i.test(html) ||
      /name=["']twitter:image(?::src)?["']/i.test(html),
    hasOgTitle: /property=["']og:title["']/i.test(html),
    hasOgDescription: /property=["']og:description["']/i.test(html),
    hasOgVideo: /property=["']og:video(?::secure_url)?["']/i.test(html),
  };
}

export function parseOEmbedErrorDetails(text: string): {
  code: number | null;
  subcode: number | null;
  message: string | null;
} {
  try {
    const payload = JSON.parse(text) as {
      error?: { code?: number; error_subcode?: number; message?: string };
    };
    return {
      code: payload.error?.code ?? null,
      subcode: payload.error?.error_subcode ?? null,
      message: payload.error?.message?.slice(0, 160) ?? null,
    };
  } catch {
    return { code: null, subcode: null, message: null };
  }
}

export function summarizeOEmbedPayload(payload: Record<string, unknown>): {
  payloadKeys: string[];
  hasThumbnailField: boolean;
  hasAuthorField: boolean;
  hasEmbedHtml: boolean;
  embedHtmlLength: number;
} {
  const html = typeof payload.html === 'string' ? payload.html : '';
  return {
    payloadKeys: Object.keys(payload).sort(),
    hasThumbnailField: typeof payload.thumbnail_url === 'string' && payload.thumbnail_url.length > 0,
    hasAuthorField: typeof payload.author_name === 'string' && payload.author_name.length > 0,
    hasEmbedHtml: html.length > 0,
    embedHtmlLength: html.length,
  };
}

export function categorizeOEmbedFailure(status: number, errorDetails: {
  code: number | null;
  subcode: number | null;
}): InstagramFailureCategory {
  if (errorDetails.code === 24 || errorDetails.subcode === 2207045) {
    return 'oembed_not_embeddable';
  }
  const httpCategory = categorizeHttpStatus(status);
  if (httpCategory) return httpCategory;
  return 'unknown';
}

export function categorizeOpenGraphFailure(input: {
  error: unknown;
  status?: number;
  contentType?: string;
  redirectCount?: number;
  signals?: InstagramHtmlSignals;
  preview?: Pick<ResolvedPreview, 'imageUrl' | 'title' | 'description'>;
}): InstagramFailureCategory {
  if (input.error instanceof Error) {
    const reason = sanitizeFailureReason(input.error);
    if (reason === 'timeout') return 'timeout';
    if (reason === 'redirect_failed') return 'redirect_failed';
    if (reason === 'unsupported_content_type') return 'invalid_content_type';
    if (reason === 'response_too_large') return 'response_too_large';
    if (reason === 'blocked_host') return 'blocked_host';
    if (reason.startsWith('upstream_401') || reason.startsWith('upstream_403')) return 'auth_error';
    if (reason.startsWith('upstream_429')) return 'rate_limited';
    if (reason.startsWith('upstream_')) return 'server_error';
  }

  if (input.signals?.pageKind === 'login_page') return 'login_page';
  if (input.signals?.pageKind === 'challenge_page') return 'challenge_page';
  if (input.preview && !input.preview.imageUrl) return 'missing_og_image';
  return 'unknown';
}

export function inspectOpenGraphPreview(html: string, finalUrl: string): {
  preview: ResolvedPreview;
  signals: InstagramHtmlSignals;
} {
  const preview = parseHtmlPreview(html, finalUrl);
  const signals = classifyInstagramHtml(html);
  return { preview, signals };
}

export async function followPublicHtmlRedirects(input: {
  startUrl: URL;
  userAgent: string;
  fetchWithTimeout: (url: string, init?: RequestInit) => Promise<Response>;
  readLimitedText: (response: Response, maxBytes: number) => Promise<string>;
  assertPublicHostname: (hostname: string) => Promise<void>;
  maxRedirects: number;
  maxBytes: number;
}): Promise<{
  html: string;
  finalUrl: string;
  status: number;
  contentType: string;
  redirectCount: number;
}> {
  let current = input.startUrl;
  let redirectCount = 0;
  let lastStatus = 0;
  let lastContentType = '';

  for (; redirectCount <= input.maxRedirects; redirectCount += 1) {
    await input.assertPublicHostname(current.hostname);
    const response = await input.fetchWithTimeout(current.toString(), {
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'User-Agent': input.userAgent,
      },
    });

    lastStatus = response.status;
    lastContentType = response.headers.get('content-type')?.toLowerCase() ?? '';

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirectCount === input.maxRedirects) {
        throw new Error('redirect_failed');
      }
      current = normalizeInspirationUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) throw new Error(`upstream_${response.status}`);
    if (
      !lastContentType.includes('text/html') &&
      !lastContentType.includes('application/xhtml+xml')
    ) {
      throw new Error('unsupported_content_type');
    }

    return {
      html: await input.readLimitedText(response, input.maxBytes),
      finalUrl: current.toString(),
      status: lastStatus,
      contentType: lastContentType,
      redirectCount,
    };
  }

  throw new Error('redirect_failed');
}
