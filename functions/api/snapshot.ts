import type { Course, EventItem, NotificationItem, Semester, Snapshot } from '../../src/domain/types';

interface Env { DB: D1Database }
interface CourseRow { id: string; title: string; teacher: string; location: string; weekday: number; start_period: number; end_period: number; start_week: number; end_week: number; week_type: Course['weekType'] }
interface EventRow { id: string; title: string; description: string; category: string; start_at: string; due_at: string; done: number }
interface NotificationRow { id: string; kind: NotificationItem['kind']; priority: NotificationItem['priority']; title: string; body: string; due_at: string | null; pinned: number; published_at: string }

export async function loadSnapshot(db: D1Database): Promise<Snapshot> {
  const [settings, courseRows, eventRows, notificationRows] = await Promise.all([
    db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>(),
    db.prepare('SELECT * FROM courses ORDER BY weekday, start_period').all<CourseRow>(),
    db.prepare('SELECT * FROM events ORDER BY due_at').all<EventRow>(),
    db.prepare('SELECT * FROM notifications WHERE status = ? ORDER BY pinned DESC, published_at DESC').bind('published').all<NotificationRow>()
  ]);
  const values = Object.fromEntries((settings.results ?? []).map(({ key, value }) => [key, value]));
  const semester: Semester = values.semester ? JSON.parse(values.semester) as Semester : { title: '', startDate: '', endDate: '', periods: [] };
  const courses: Course[] = (courseRows.results ?? []).map(row => ({ id: row.id, title: row.title, teacher: row.teacher, location: row.location, weekday: row.weekday, startPeriod: row.start_period, endPeriod: row.end_period, startWeek: row.start_week, endWeek: row.end_week, weekType: row.week_type }));
  const events: EventItem[] = (eventRows.results ?? []).map(row => ({ id: row.id, title: row.title, description: row.description, category: row.category, startAt: row.start_at, dueAt: row.due_at, done: Boolean(row.done) }));
  const notifications: NotificationItem[] = (notificationRows.results ?? []).map(row => ({ id: row.id, kind: row.kind, priority: row.priority, title: row.title, body: row.body, dueAt: row.due_at, pinned: Boolean(row.pinned), publishedAt: row.published_at }));
  return { semester, courses, events, notifications, demo: values.demo === 'true' };
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    return Response.json(await loadSnapshot(env.DB), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: '班务数据暂不可用' }, { status: 503 });
  }
};
