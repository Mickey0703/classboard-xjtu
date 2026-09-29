export interface Period { number: number; start: string; end: string }
export interface Semester { title: string; className?: string; startDate: string; endDate: string; periods: Period[] }
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
export type NotificationKind = 'notice' | 'task';
export type NotificationPriority = 'normal' | 'important' | 'urgent';
export type NotificationStatus = 'draft' | 'published' | 'withdrawn';
export interface NotificationItem {
  id: string; kind: NotificationKind; priority: NotificationPriority;
  title: string; body: string; dueAt: string | null; pinned: boolean; publishedAt: string;
}
export interface ClassMember { email: string; displayName: string; active: boolean }
export interface RecipientStatus { notificationId: string; acknowledgedAt: string | null; completedAt: string | null }
export interface Snapshot { semester: Semester; courses: Course[]; events: EventItem[]; notifications: NotificationItem[]; demo: boolean }
export interface CourseOccurrence { course: Course; date: string; startAt: Date; endAt: Date }
export type EventStatus = 'done' | 'upcoming' | 'soon' | 'overdue';
