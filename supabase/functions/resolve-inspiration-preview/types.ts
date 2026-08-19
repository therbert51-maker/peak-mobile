export type PreviewKind = 'video' | 'image' | 'article' | 'website';

export type ResolvedPreview = {
  normalizedUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  source: string;
  kind: PreviewKind;
};

export type InspirationPreviewRow = {
  id: string;
  url: string | null;
  created_by: string | null;
  normalized_url: string | null;
  preview_status: 'pending' | 'processing' | 'ready' | 'failed' | 'skipped';
  preview_fetched_at: string | null;
};
