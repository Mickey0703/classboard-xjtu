import { describe, expect, it } from 'vitest';
import { getCoursesForDate, getEventStatus, getNextClass, getTeachingWeek } from './calendar';
import type { Course, EventItem, Semester } from './types';

const semester: Semester = {
  title: '测试学期', startDate: '2026-09-02', endDate: '2027-01-10',
  periods: [{ number: 1, start: '08:00', end: '08:45' }, { number: 2, start: '08:55', end: '09:40' }]
};
const courses: Course[] = [
  { id: 'a', title: '高等数学', teacher: '张老师', location: '教学楼 A101', weekday: 1, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16, weekType: 'all' },
  { id: 'b', title: '单周实验', teacher: '李老师', location: '实验楼', weekday: 1, startPeriod: 1, endPeriod: 1, startWeek: 1, endWeek: 16, weekType: 'odd' },
  { id: 'c', title: '双周实验', teacher: '王老师', location: '实验楼', weekday: 1, startPeriod: 2, endPeriod: 2, startWeek: 2, endWeek: 16, weekType: 'even' }
];

describe('calendar', () => {
  it('anchors the first teaching week to Monday even when semester starts Wednesday', () => {
    expect(getTeachingWeek('2026-08-31', semester)).toBe(1);
    expect(getTeachingWeek('2026-09-07', semester)).toBe(2);
  });
  it('filters odd/even courses and weeks outside their range', () => {
    expect(getCoursesForDate('2026-08-31', courses, semester).map(c => c.course.id)).toEqual(['a', 'b']);
    expect(getCoursesForDate('2026-09-07', courses, semester).map(c => c.course.id)).toEqual(['a', 'c']);
    expect(getCoursesForDate('2027-01-11', courses, semester)).toEqual([]);
  });
  it('finds the next class in Shanghai time and handles no class', () => {
    expect(getNextClass(new Date('2026-08-31T00:30:00Z'), courses, semester)?.course.id).toBe('a');
    expect(getNextClass(new Date('2027-01-11T00:00:00Z'), courses, semester)).toBeNull();
  });
  it('judges a next-day deadline in Shanghai time', () => {
    const event: EventItem = { id: 'e', title: '作业', description: '', category: '学习', startAt: '2026-09-28T20:00:00+08:00', dueAt: '2026-09-29T00:30:00+08:00', done: false };
    expect(getEventStatus(new Date('2026-09-28T16:00:00Z'), event)).toBe('soon');
    expect(getEventStatus(new Date('2026-09-28T16:31:00Z'), event)).toBe('overdue');
  });
});
