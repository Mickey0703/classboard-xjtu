import { expect, it } from 'vitest';
import { buildIcs } from './ics';
import type { Course, Semester } from './types';

it('exports Shanghai class times and escapes calendar text', () => {
  const semester: Semester = { title: '秋季', startDate: '2026-09-07', endDate: '2026-09-20', periods: [{ number: 1, start: '08:00', end: '08:45' }] };
  const courses: Course[] = [{ id: 'x', title: '物理,实验', teacher: '王;老师', location: 'A101', weekday: 1, startPeriod: 1, endPeriod: 1, startWeek: 1, endWeek: 2, weekType: 'all' }];
  const ics = buildIcs(courses, semester);
  expect(ics).toContain('DTSTART:20260907T000000Z');
  expect(ics).toContain('DTEND:20260907T004500Z');
  expect(ics).toContain('SUMMARY:物理\\,实验');
  expect(ics).toContain('王\\;老师');
  expect(ics.split('BEGIN:VEVENT').length - 1).toBe(2);
});
