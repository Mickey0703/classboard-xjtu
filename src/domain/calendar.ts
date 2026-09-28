import type { Course, CourseOccurrence, EventItem, EventStatus, Semester } from './types';

const DAY = 86_400_000;
const CN_OFFSET = 8 * 60 * 60 * 1000;

export function dateUtc(date: string): number { return Date.parse(`${date}T00:00:00Z`); }
export function localDate(date: Date): string { return new Date(date.getTime() + CN_OFFSET).toISOString().slice(0, 10); }
export function addDays(date: string, days: number): string { return new Date(dateUtc(date) + days * DAY).toISOString().slice(0, 10); }
export function weekday(date: string): number { return (new Date(dateUtc(date)).getUTCDay() + 6) % 7 + 1; }
export function mondayOf(date: string): string { return addDays(date, 1 - weekday(date)); }
export function shanghaiTime(date: string, time: string): Date { return new Date(`${date}T${time}:00+08:00`); }

export function getTeachingWeek(date: string, semester: Semester): number {
  return Math.floor((dateUtc(mondayOf(date)) - dateUtc(mondayOf(semester.startDate))) / (7 * DAY)) + 1;
}

export function getCoursesForDate(date: string, courses: Course[], semester: Semester): CourseOccurrence[] {
  if (date < mondayOf(semester.startDate) || date > semester.endDate) return [];
  const week = getTeachingWeek(date, semester);
  return courses.filter(course =>
    course.weekday === weekday(date) && week >= course.startWeek && week <= course.endWeek &&
    (course.weekType === 'all' || (course.weekType === 'odd' ? week % 2 === 1 : week % 2 === 0))
  ).map(course => {
    const first = semester.periods.find(p => p.number === course.startPeriod);
    const last = semester.periods.find(p => p.number === course.endPeriod);
    if (!first || !last) return null;
    return { course, date, startAt: shanghaiTime(date, first.start), endAt: shanghaiTime(date, last.end) };
  }).filter((value): value is CourseOccurrence => value !== null)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export function getNextClass(now: Date, courses: Course[], semester: Semester): CourseOccurrence | null {
  const today = localDate(now);
  const start = today < mondayOf(semester.startDate) ? mondayOf(semester.startDate) : today;
  for (let date = start; date <= semester.endDate; date = addDays(date, 1)) {
    const next = getCoursesForDate(date, courses, semester).find(c => c.startAt.getTime() > now.getTime());
    if (next) return next;
  }
  return null;
}

export function getEventStatus(now: Date, event: EventItem): EventStatus {
  if (event.done) return 'done';
  const remaining = Date.parse(event.dueAt) - now.getTime();
  if (remaining < 0) return 'overdue';
  if (remaining <= DAY) return 'soon';
  return 'upcoming';
}
