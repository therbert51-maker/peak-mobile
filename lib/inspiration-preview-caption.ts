import type { Inspiration } from '@/types/database';

type PreviewCaptionFields = Pick<
  Inspiration,
  'preview_title' | 'preview_description'
>;

export function instagramPreviewCaption(
  item: PreviewCaptionFields,
  fallbackTitle?: string | null,
  fallbackNotes?: string | null,
): string | null {
  const fromPreview = item.preview_title?.trim() || item.preview_description?.trim();
  if (fromPreview) return fromPreview;
  const fromTitle = fallbackTitle?.trim();
  if (fromTitle) return fromTitle;
  return fallbackNotes?.trim() || null;
}

export function isInstagramPreviewSource(source: string | null | undefined): boolean {
  return source?.trim().toLowerCase() === 'instagram';
}
