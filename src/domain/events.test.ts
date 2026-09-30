import { expect, it } from 'vitest';
import { getEventStatus } from './events';
import type { EventItem } from './types';

it('judges overdue, upcoming and completed matters in Shanghai time', () => {
  const event: EventItem = { id: 'e', title: '班会', description: '', category: '班级', startAt: '2026-09-29T18:00:00+08:00', dueAt: '2026-09-30T00:30:00+08:00', done: false };
  expect(getEventStatus(new Date('2026-09-29T16:00:00Z'), event)).toBe('soon');
  expect(getEventStatus(new Date('2026-09-29T16:31:00Z'), event)).toBe('overdue');
  expect(getEventStatus(new Date('2026-09-29T16:31:00Z'), { ...event, done: true })).toBe('done');
});
