/** Parse YYYY-MM-DD as local calendar date; returns null if invalid. */
export function parseIsoDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDisplayDate(iso: string | null): string | null {
  if (!iso?.trim()) return null;
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTripDateRange(
  startDate: string | null,
  endDate: string | null,
): string | null {
  const start = formatDisplayDate(startDate);
  const end = formatDisplayDate(endDate);
  if (start && end) {
    return `${start} – ${end}`;
  }
  if (start) return start;
  if (end) return end;
  return null;
}

export function validateTripDates(
  startDate: string,
  endDate: string,
): string | null {
  const startRaw = startDate.trim();
  const endRaw = endDate.trim();

  if (startRaw && !parseIsoDate(startRaw)) {
    return 'Start date must be YYYY-MM-DD.';
  }
  if (endRaw && !parseIsoDate(endRaw)) {
    return 'End date must be YYYY-MM-DD.';
  }
  if (!startRaw || !endRaw) {
    return null;
  }

  const start = parseIsoDate(startRaw)!;
  const end = parseIsoDate(endRaw)!;
  if (end.getTime() < start.getTime()) {
    return 'End date cannot be before start date.';
  }
  return null;
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
