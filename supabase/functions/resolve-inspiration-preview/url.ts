const MAX_URL_LENGTH = 2048;

declare const Deno: {
  resolveDns(hostname: string, recordType: 'A' | 'AAAA'): Promise<string[]>;
};

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igsh',
  'igshid',
  'mc_cid',
  'mc_eid',
  'si',
  'ttclid',
]);

const INSTAGRAM_SHORTCODE = /^[A-Za-z0-9_-]+$/;

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
  'host.docker.internal',
]);

function isIpv4(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

export function isBlockedIp(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '');

  if (isIpv4(value)) {
    const octets = value.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => octet < 0 || octet > 255)) return true;
    const [a, b, c] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (!value.includes(':')) return false;

  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    /^fe[89ab]/.test(value) ||
    value.startsWith('ff') ||
    value.startsWith('::ffff:127.') ||
    value.startsWith('::ffff:10.') ||
    value.startsWith('::ffff:192.168.') ||
    value.startsWith('::ffff:169.254.')
  );
}

export function normalizeInspirationUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    throw new Error('invalid_url');
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withScheme);

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid_scheme');
  if (url.username || url.password) throw new Error('credentials_not_allowed');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('port_not_allowed');

  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!url.hostname || isBlockedHostname(url.hostname)) throw new Error('blocked_host');

  url.hash = '';
  const keys = Array.from(url.searchParams.keys());
  for (const key of keys) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  return url;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  return (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    isBlockedIp(host)
  );
}

export async function assertPublicHostname(hostname: string): Promise<void> {
  if (isBlockedHostname(hostname)) throw new Error('blocked_host');
  if (isIpv4(hostname) || hostname.includes(':')) return;

  const addresses = await Promise.allSettled([
    Deno.resolveDns(hostname, 'A'),
    Deno.resolveDns(hostname, 'AAAA'),
  ]);
  const resolved = addresses.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

  if (resolved.length === 0 || resolved.some(isBlockedIp)) {
    throw new Error('blocked_host');
  }
}

export function safeResolvedUrl(input: string | null, baseUrl: string): string | null {
  if (!input?.trim()) return null;
  try {
    const url = new URL(input.trim(), baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password || isBlockedHostname(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function platformForUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '');
  const isDomain = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (host === 'youtu.be' || isDomain('youtube.com')) return 'YouTube';
  if (isDomain('tiktok.com')) return 'TikTok';
  if (isDomain('instagram.com')) return 'Instagram';
  if (isDomain('pinterest.com') || host === 'pin.it') return 'Pinterest';
  if (isDomain('facebook.com') || host === 'fb.watch') return 'Facebook';
  return null;
}

export function instagramPostPath(
  url: URL,
): { type: 'post' | 'reel'; shortcode: string } | null {
  if (platformForUrl(url) !== 'Instagram') return null;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  const [segment, shortcode] = parts;
  if (!INSTAGRAM_SHORTCODE.test(shortcode)) return null;

  if (segment === 'p') return { type: 'post', shortcode };
  if (segment === 'reel' || segment === 'reels') return { type: 'reel', shortcode };
  return null;
}

export function normalizeInstagramPostUrl(url: URL): URL | null {
  const post = instagramPostPath(url);
  if (!post) return null;

  const path = post.type === 'post' ? `/p/${post.shortcode}/` : `/reel/${post.shortcode}/`;
  return new URL(`https://www.instagram.com${path}`);
}

export function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] ?? null;
  if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const parts = url.pathname.split('/').filter(Boolean);
  if (['shorts', 'embed', 'live'].includes(parts[0] ?? '')) return parts[1] ?? null;
  return null;
}
