import type { Course, EventItem, Semester } from '../../../src/domain/types';

const text = (value: unknown, max = 200): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
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

export function validCourse(c: Partial<Course>): c is Course {
  return text(c.title, 100) && typeof c.teacher === 'string' && c.teacher.length <= 80 && typeof c.location === 'string' && c.location.length <= 100 &&
    integer(c.weekday, 1, 7) && integer(c.startPeriod, 1, 20) && integer(c.endPeriod, c.startPeriod, 20) &&
    integer(c.startWeek, 1, 40) && integer(c.endWeek, c.startWeek, 40) && ['all', 'odd', 'even'].includes(c.weekType ?? '');
}
export function validEvent(e: Partial<EventItem>): e is EventItem {
  return text(e.title, 120) && typeof e.description === 'string' && e.description.length <= 2000 && typeof e.category === 'string' && e.category.length <= 40 &&
    shanghaiTimestamp(e.startAt) && shanghaiTimestamp(e.dueAt) && Date.parse(e.startAt) <= Date.parse(e.dueAt) && typeof e.done === 'boolean';
}
export function validSemester(s: Partial<Semester>): s is Semester {
  if (!(text(s.title, 100) && (s.className === undefined || (typeof s.className === 'string' && s.className.length <= 60)) && realDate(s.startDate) && realDate(s.endDate) && s.startDate <= s.endDate && Array.isArray(s.periods) && s.periods.length > 0 && s.periods.length <= 20)) return false;
  return s.periods.every((p, index) => integer(p.number, 1, 20) && realTime(p.start) && realTime(p.end) && p.start < p.end && (index === 0 || (p.number > s.periods![index - 1].number && p.start >= s.periods![index - 1].end)));
}

export function periodsContainCourse(course: Pick<Course, 'startPeriod' | 'endPeriod'>, semester: Semester): boolean {
  const available = new Set(semester.periods.map(p => p.number));
  for (let number = course.startPeriod; number <= course.endPeriod; number++) if (!available.has(number)) return false;
  return true;
}
