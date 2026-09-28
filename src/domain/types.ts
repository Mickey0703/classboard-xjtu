export interface Period { number: number; start: string; end: string }
export interface Semester { title: string; startDate: string; endDate: string; periods: Period[] }
export type WeekType = 'all' | 'odd' | 'even';
export interface Course {
  id: string; title: string; teacher: string; location: string;
  weekday: number; startPeriod: number; endPeriod: number;
  startWeek: number; endWeek: number; weekType: WeekType;
}
export interface EventItem {
  id: string; title: string; description: string; category: string;
  startAt: string; dueAt: string; done: boolean;
}
export interface Snapshot { semester: Semester; courses: Course[]; events: EventItem[]; demo: boolean }
export interface CourseOccurrence { course: Course; date: string; startAt: Date; endAt: Date }
export type EventStatus = 'done' | 'upcoming' | 'soon' | 'overdue';
