import type { Ionicons } from '@expo/vector-icons';

import type { ItineraryItem } from '@/types/database';

export const ITINERARY_CATEGORIES = [
  'flight',
  'lodging',
  'food',
  'activity',
  'transportation',
  'reservation',
  'other',
] as const;

export type ItineraryCategory = (typeof ITINERARY_CATEGORIES)[number];

export const ITINERARY_STATUSES = ['idea', 'planned', 'booked', 'completed'] as const;

export type ItineraryStatus = (typeof ITINERARY_STATUSES)[number];

export const CATEGORY_META: Record<
  ItineraryCategory,
  { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  flight: { label: 'Flight', icon: 'airplane-outline' },
  lodging: { label: 'Lodging', icon: 'bed-outline' },
  food: { label: 'Food', icon: 'restaurant-outline' },
  activity: { label: 'Activity', icon: 'sparkles-outline' },
  transportation: { label: 'Transport', icon: 'car-outline' },
  reservation: { label: 'Reservation', icon: 'ticket-outline' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
};

export const STATUS_META: Record<ItineraryStatus, { label: string; color: string }> = {
  idea: { label: 'Idea', color: '#697386' },
  planned: { label: 'Planned', color: '#7868E6' },
  booked: { label: 'Booked', color: '#59D5D8' },
  completed: { label: 'Done', color: '#36B37E' },
};

export type ItineraryDateGroup = {
  eventDate: string;
  headerLabel: string;
  items: ItineraryItem[];
};

export function formatItineraryDateHeader(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function groupItineraryByDate(items: ItineraryItem[]): ItineraryDateGroup[] {
  const sorted = [...items].sort((a, b) => {
    if (a.event_date !== b.event_date) {
      return a.event_date.localeCompare(b.event_date);
    }
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }
    return (a.start_time ?? '').localeCompare(b.start_time ?? '');
  });

  const map = new Map<string, ItineraryItem[]>();
  for (const item of sorted) {
    const list = map.get(item.event_date) ?? [];
    list.push(item);
    map.set(item.event_date, list);
  }

  return Array.from(map.entries()).map(([eventDate, groupItems]) => ({
    eventDate,
    headerLabel: formatItineraryDateHeader(eventDate),
    items: groupItems,
  }));
}

export function timeToMinutes(time: string | null): number | null {
  if (!time?.trim()) return null;
  const parts = time.trim().split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  return parts[0] * 60 + parts[1];
}

export function formatItineraryTime(time: string | null): string | null {
  const minutes = timeToMinutes(time);
  if (minutes == null) return null;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
}

export function validateItineraryTimes(startTime: string, endTime: string): string | null {
  const startRaw = startTime.trim();
  const endRaw = endTime.trim();
  if (!startRaw || !endRaw) return null;

  const start = timeToMinutes(startRaw.length === 5 ? `${startRaw}:00` : startRaw);
  const end = timeToMinutes(endRaw.length === 5 ? `${endRaw}:00` : endRaw);

  if (start == null) return 'Start time must be HH:MM.';
  if (end == null) return 'End time must be HH:MM.';
  if (end < start) return 'End time cannot be earlier than start time.';
  return null;
}

export function normalizeTimeForDb(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return null;
}
