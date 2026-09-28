import type { Course, EventItem, Semester } from '../../../src/domain/types';

const text = (value: unknown, max = 200): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;

export function validCourse(c: Partial<Course>): c is Course {
  return text(c.title, 100) && typeof c.teacher === 'string' && c.teacher.length <= 80 && typeof c.location === 'string' && c.location.length <= 100 &&
    integer(c.weekday, 1, 7) && integer(c.startPeriod, 1, 20) && integer(c.endPeriod, c.startPeriod, 20) &&
    integer(c.startWeek, 1, 40) && integer(c.endWeek, c.startWeek, 40) && ['all', 'odd', 'even'].includes(c.weekType ?? '');
}
export function validEvent(e: Partial<EventItem>): e is EventItem {
  return text(e.title, 120) && typeof e.description === 'string' && e.description.length <= 2000 && typeof e.category === 'string' && e.category.length <= 40 &&
    text(e.startAt, 40) && text(e.dueAt, 40) && !Number.isNaN(Date.parse(e.startAt)) && !Number.isNaN(Date.parse(e.dueAt)) && Date.parse(e.startAt) <= Date.parse(e.dueAt) && typeof e.done === 'boolean';
}
export function validSemester(s: Partial<Semester>): s is Semester {
  return text(s.title, 100) && (s.className === undefined || (typeof s.className === 'string' && s.className.length <= 60)) && /^\d{4}-\d{2}-\d{2}$/.test(s.startDate ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(s.endDate ?? '') && s.startDate! <= s.endDate! &&
    Array.isArray(s.periods) && s.periods.length > 0 && s.periods.length <= 20 && s.periods.every(p => integer(p.number, 1, 20) && /^\d{2}:\d{2}$/.test(p.start) && /^\d{2}:\d{2}$/.test(p.end) && p.start < p.end);
}
