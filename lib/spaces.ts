import type { Space } from '@/types/database';

/**
 * Logs spaces that predate owner_id — fix ownership in Supabase (dev only).
 */
export function warnSpacesWithNullOwner(spaces: Space[]): void {
  if (!__DEV__) {
    return;
  }

  const missingOwner = spaces.filter((space) => space.owner_id == null);
  if (missingOwner.length === 0) {
    return;
  }

  console.warn(
    `[Peak] ${missingOwner.length} space(s) have null owner_id. Assign ownership manually in Supabase (do not auto-assign in the app):`,
    missingOwner.map((space) => ({ id: space.id, name: space.name })),
  );
}

function formatSupabaseError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  return [error.message, error.details, error.hint, error.code ? `Code: ${error.code}` : null]
    .filter(Boolean)
    .join('\n\n');
}

export { formatSupabaseError };
