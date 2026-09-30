import type { EventItem } from '../../../src/domain/types';

const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const realDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const realTime = (value: unknown): value is string => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const shanghaiTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):(\d{2})\+08:00$/);
  return Boolean(match && realDate(match[1]) && realTime(match[2]) && Number(match[3]) < 60);
};

export function validEvent(e: Partial<EventItem>): e is EventItem {
  return text(e.title, 120) && typeof e.description === 'string' && e.description.length <= 2000 && typeof e.category === 'string' && e.category.length <= 40 &&
    shanghaiTimestamp(e.startAt) && shanghaiTimestamp(e.dueAt) && Date.parse(e.startAt) <= Date.parse(e.dueAt) && typeof e.done === 'boolean';
}
