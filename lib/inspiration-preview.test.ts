import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  categorizeHttpStatus,
  categorizeOEmbedFailure,
  classifyInstagramHtml,
  parseOEmbedErrorDetails,
  summarizeOEmbedPayload,
} from '../supabase/functions/resolve-inspiration-preview/instagram-diagnostics';
import { instagramPreviewCaption } from '@/lib/inspiration-preview-caption';
import {
  fallbackPreview,
  parseHtmlPreview,
  parseInstagramOEmbedPreview,
} from '../supabase/functions/resolve-inspiration-preview/metadata';
import {
  instagramPostPath,
  isBlockedHostname,
  isBlockedIp,
  normalizeInspirationUrl,
  normalizeInstagramPostUrl,
  platformForUrl,
  youtubeVideoId,
} from '../supabase/functions/resolve-inspiration-preview/url';

describe('inspiration preview URL handling', () => {
  it('normalizes URLs and removes common tracking parameters', () => {
    const url = normalizeInspirationUrl(
      'Example.COM/story?utm_source=social&place=mallorca#comments',
    );
    assert.equal(url.toString(), 'https://example.com/story?place=mallorca');
  });

  it('rejects private and local destinations', () => {
    assert.equal(isBlockedHostname('localhost'), true);
    assert.equal(isBlockedHostname('api.internal'), true);
    assert.equal(isBlockedIp('127.0.0.1'), true);
    assert.equal(isBlockedIp('10.2.3.4'), true);
    assert.equal(isBlockedIp('192.168.1.1'), true);
    assert.equal(isBlockedIp('8.8.8.8'), false);
    assert.throws(() => normalizeInspirationUrl('http://localhost/admin'));
  });

  it('recognizes supported social platforms and YouTube IDs', () => {
    const shorts = normalizeInspirationUrl('https://youtube.com/shorts/abc123?si=tracking');
    assert.equal(platformForUrl(shorts), 'YouTube');
    assert.equal(youtubeVideoId(shorts), 'abc123');
    assert.equal(platformForUrl(new URL('https://www.tiktok.com/@peak/video/123')), 'TikTok');
    assert.equal(platformForUrl(new URL('https://notinstagram.com/reel/123')), null);
  });

  it('detects and normalizes public Instagram post and reel URLs', () => {
    const post = normalizeInspirationUrl(
      'https://www.instagram.com/p/CxYzAbCdEf/?igsh=abc123&utm_source=share',
    );
    assert.deepEqual(instagramPostPath(post), { type: 'post', shortcode: 'CxYzAbCdEf' });
    assert.equal(
      normalizeInstagramPostUrl(post)?.toString(),
      'https://www.instagram.com/p/CxYzAbCdEf/',
    );

    const reel = normalizeInspirationUrl('https://instagram.com/reels/ReEl12345/');
    assert.deepEqual(instagramPostPath(reel), { type: 'reel', shortcode: 'ReEl12345' });
    assert.equal(
      normalizeInstagramPostUrl(reel)?.toString(),
      'https://www.instagram.com/reel/ReEl12345/',
    );

    const profile = normalizeInspirationUrl('https://www.instagram.com/peaktravel/');
    assert.equal(instagramPostPath(profile), null);
    assert.equal(normalizeInstagramPostUrl(profile), null);
  });
});

describe('inspiration preview metadata', () => {
  it('extracts Open Graph fields regardless of attribute order', () => {
    const preview = parseHtmlPreview(
      `
        <html><head>
          <meta content="Peak Mallorca Guide" property="og:title">
          <meta property="og:description" content="Hidden beaches &amp; local food">
          <meta content="/images/hero.jpg" property="og:image">
          <meta property="og:site_name" content="Peak Travel">
          <meta property="og:type" content="article">
        </head></html>
      `,
      'https://example.com/mallorca',
    );

    assert.equal(preview.title, 'Peak Mallorca Guide');
    assert.equal(preview.description, 'Hidden beaches & local food');
    assert.equal(preview.imageUrl, 'https://example.com/images/hero.jpg');
    assert.equal(preview.source, 'Peak Travel');
    assert.equal(preview.kind, 'article');
  });

  it('creates a deterministic YouTube video fallback', () => {
    const preview = fallbackPreview(new URL('https://youtu.be/abc123'));
    assert.equal(preview.kind, 'video');
    assert.equal(preview.source, 'YouTube');
    assert.equal(preview.imageUrl, 'https://i.ytimg.com/vi/abc123/hqdefault.jpg');
  });

  it('parses Instagram oEmbed metadata and embed thumbnails when present', () => {
    const preview = parseInstagramOEmbedPreview(
      {
        provider_name: 'Instagram',
        type: 'rich',
        title: 'Sunset in Mallorca',
        author_name: 'peaktravel',
        thumbnail_url: 'https://cdninstagram.com/thumb.jpg',
      },
      'https://www.instagram.com/reel/ReEl12345/',
    );

    assert.equal(preview.source, 'Instagram');
    assert.equal(preview.title, 'Sunset in Mallorca');
    assert.equal(preview.description, 'By peaktravel');
    assert.equal(preview.imageUrl, 'https://cdninstagram.com/thumb.jpg');
    assert.equal(preview.kind, 'video');
  });
});

describe('instagram preview diagnostics', () => {
  it('classifies HTTP auth and rate-limit statuses', () => {
    assert.equal(categorizeHttpStatus(401), 'auth_error');
    assert.equal(categorizeHttpStatus(403), 'auth_error');
    assert.equal(categorizeHttpStatus(429), 'rate_limited');
    assert.equal(categorizeHttpStatus(200), null);
  });

  it('summarizes tokenless Instagram oEmbed payloads without thumbnail fields', () => {
    const summary = summarizeOEmbedPayload({
      provider_name: 'Instagram',
      type: 'rich',
      html: '<blockquote class="instagram-media"></blockquote>',
      version: '1.0',
      width: 658,
    });

    assert.equal(summary.hasThumbnailField, false);
    assert.equal(summary.hasAuthorField, false);
    assert.equal(summary.hasEmbedHtml, true);
    assert.deepEqual(summary.payloadKeys, ['html', 'provider_name', 'type', 'version', 'width']);
  });

  it('detects login pages and missing og:image signals', () => {
    const login = classifyInstagramHtml('<html><title>Log in to Instagram</title></html>');
    assert.equal(login.pageKind, 'login_page');
    assert.equal(login.hasOgImage, false);

    const metadata = classifyInstagramHtml(
      '<meta property="og:title" content="Peak"><meta property="og:video" content="https://example.com/a.mp4">',
    );
    assert.equal(metadata.pageKind, 'metadata_page');
    assert.equal(metadata.hasOgTitle, true);
    assert.equal(metadata.hasOgVideo, true);
    assert.equal(metadata.hasOgImage, false);
  });

  it('parses oEmbed error codes for non-embeddable media', () => {
    const details = parseOEmbedErrorDetails(
      JSON.stringify({
        error: {
          code: 24,
          error_subcode: 2207045,
          message: 'The requested media could not be embedded',
        },
      }),
    );
    assert.equal(details.code, 24);
    assert.equal(details.subcode, 2207045);
    assert.equal(
      categorizeOEmbedFailure(400, details),
      'oembed_not_embeddable',
    );
  });
});

describe('instagram preview fallback caption', () => {
  it('prefers preview metadata, then inspo title, then notes', () => {
    const item = {
      preview_title: 'Sunset reel',
      preview_description: 'By peaktravel',
    };

    assert.equal(
      instagramPreviewCaption(item, 'Saved title', 'Saved notes'),
      'Sunset reel',
    );
    assert.equal(
      instagramPreviewCaption(
        { ...item, preview_title: null, preview_description: null },
        'Saved title',
        'Saved notes',
      ),
      'Saved title',
    );
    assert.equal(
      instagramPreviewCaption(
        { ...item, preview_title: null, preview_description: null },
        '  ',
        'Saved notes',
      ),
      'Saved notes',
    );
  });
});
