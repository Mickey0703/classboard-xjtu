import { addDays, getCoursesForDate, mondayOf } from './calendar';
import type { Course, Semester } from './types';

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const utc = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export function buildIcs(courses: Course[], semester: Semester): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Classboard XJTU//ZH', 'CALSCALE:GREGORIAN'];
  for (let date = mondayOf(semester.startDate); date <= semester.endDate; date = addDays(date, 1)) {
    for (const { course, startAt, endAt } of getCoursesForDate(date, courses, semester)) {
      lines.push('BEGIN:VEVENT', `UID:${course.id}-${date}@classboard-xjtu`, `DTSTAMP:${utc(new Date())}`,
        `DTSTART:${utc(startAt)}`, `DTEND:${utc(endAt)}`, `SUMMARY:${escape(course.title)}`,
        `LOCATION:${escape(course.location)}`, `DESCRIPTION:${escape(course.teacher)}`, 'END:VEVENT');
    }
  }
  return lines.concat('END:VCALENDAR').join('\r\n') + '\r\n';
}
