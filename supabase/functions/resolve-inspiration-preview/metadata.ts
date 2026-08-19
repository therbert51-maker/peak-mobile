import type { PreviewKind, ResolvedPreview } from './types.ts';
import { platformForUrl, safeResolvedUrl, youtubeVideoId } from './url.ts';

type MetaMap = Map<string, string>;

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function cleanText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  const clean = decodeEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.slice(0, maxLength) : null;
}

function tagAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

function extractMetadata(html: string): { meta: MetaMap; title: string | null } {
  const meta: MetaMap = new Map();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = tagAttributes(match[0]);
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content);
  }

  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return { meta, title: titleMatch?.[1] ?? null };
}

function sourceFromHostname(url: URL): string {
  return url.hostname.replace(/^www\./, '').split('.').slice(-2, -1)[0] || url.hostname;
}

function inferKind(url: URL, meta: MetaMap, platform: string | null): PreviewKind {
  const type = meta.get('og:type')?.toLowerCase() ?? '';
  const path = url.pathname.toLowerCase();
  if (
    type.includes('video') ||
    platform === 'YouTube' ||
    platform === 'TikTok' ||
    (platform === 'Instagram' && path.includes('/reel')) ||
    (platform === 'Facebook' && (path.includes('/video') || path.includes('/watch')))
  ) {
    return 'video';
  }
  if (type.includes('article')) return 'article';
  if (type.includes('image')) return 'image';
  return 'website';
}

export function parseHtmlPreview(html: string, finalUrl: string): ResolvedPreview {
  const url = new URL(finalUrl);
  const { meta, title: documentTitle } = extractMetadata(html);
  const platform = platformForUrl(url);
  const image =
    meta.get('og:image:secure_url') ||
    meta.get('og:image') ||
    meta.get('twitter:image') ||
    meta.get('twitter:image:src');

  return {
    normalizedUrl: finalUrl,
    title: cleanText(meta.get('og:title') || meta.get('twitter:title') || documentTitle, 200),
    description: cleanText(
      meta.get('og:description') || meta.get('twitter:description') || meta.get('description'),
      500,
    ),
    imageUrl: safeResolvedUrl(image ?? null, finalUrl),
    source:
      cleanText(meta.get('og:site_name'), 80) ||
      platform ||
      sourceFromHostname(url),
    kind: inferKind(url, meta, platform),
  };
}

export function fallbackPreview(url: URL): ResolvedPreview {
  const platform = platformForUrl(url);
  const videoId = youtubeVideoId(url);
  return {
    normalizedUrl: url.toString(),
    title: null,
    description: null,
    imageUrl: videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg` : null,
    source: platform || sourceFromHostname(url),
    kind: videoId || platform === 'TikTok' ? 'video' : 'website',
  };
}

function extractImageFromInstagramEmbedHtml(html: string | null): string | null {
  if (!html) return null;

  const ogMatch =
    html.match(/property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i);
  if (ogMatch?.[1]) return ogMatch[1];

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch?.[1] ?? null;
}

export function parseInstagramOEmbedPreview(
  payload: Record<string, unknown>,
  normalizedUrl: string,
): ResolvedPreview {
  const url = new URL(normalizedUrl);
  const provider =
    typeof payload.provider_name === 'string' ? payload.provider_name : 'Instagram';
  const embedType = typeof payload.type === 'string' ? payload.type : null;
  const html = typeof payload.html === 'string' ? payload.html : null;
  const thumbnail =
    typeof payload.thumbnail_url === 'string'
      ? payload.thumbnail_url
      : extractImageFromInstagramEmbedHtml(html);
  const title = typeof payload.title === 'string' ? payload.title : null;
  const author = typeof payload.author_name === 'string' ? payload.author_name : null;

  return {
    normalizedUrl,
    title: cleanText(title, 200),
    description: cleanText(author ? `By ${author}` : null, 500),
    imageUrl: safeResolvedUrl(thumbnail, normalizedUrl),
    source: cleanText(provider, 80) || 'Instagram',
    kind:
      url.pathname.includes('/reel') || embedType === 'video'
        ? 'video'
        : 'image',
  };
}

export function parseOEmbedPreview(
  payload: Record<string, unknown>,
  normalizedUrl: string,
  fallbackSource: string,
): ResolvedPreview {
  const image = typeof payload.thumbnail_url === 'string' ? payload.thumbnail_url : null;
  const title = typeof payload.title === 'string' ? payload.title : null;
  const author = typeof payload.author_name === 'string' ? payload.author_name : null;
  const provider = typeof payload.provider_name === 'string' ? payload.provider_name : fallbackSource;

  return {
    normalizedUrl,
    title: cleanText(title, 200),
    description: cleanText(author ? `By ${author}` : null, 500),
    imageUrl: safeResolvedUrl(image, normalizedUrl),
    source: cleanText(provider, 80) || fallbackSource,
    kind: 'video',
  };
}
