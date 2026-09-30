import type { EventItem, EventStatus } from './types';

export function getEventStatus(now: Date, event: EventItem): EventStatus {
  if (event.done) return 'done';
  const remaining = Date.parse(event.dueAt) - now.getTime();
  if (remaining < 0) return 'overdue';
  if (remaining <= 86_400_000) return 'soon';
  return 'upcoming';
}
