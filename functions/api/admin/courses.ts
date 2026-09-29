import type { Course, Semester } from '../../../src/domain/types';
import { denied, invalid, requireAdmin, unavailable, type AdminData, type AdminEnv } from './auth';
import { periodsContainCourse, validCourse, validSemester } from './validate';

type Ctx = Parameters<PagesFunction<AdminEnv, string, AdminData>>[0];
async function body(context: Ctx): Promise<Partial<Course>> { return context.request.json() as Promise<Partial<Course>>; }
async function save(context: Ctx, update: boolean): Promise<Response> {
  if (!requireAdmin(context)) return denied();
  let course: Partial<Course>;
  try { course = await body(context); } catch { return invalid(); }
  if (!validCourse(course) || (update && !course.id)) return invalid();
  try {
    const setting = await context.env.DB.prepare('SELECT value FROM settings WHERE key=?').bind('semester').first<{ value: string }>();
    const semester = setting ? JSON.parse(setting.value) as Semester : null;
    if (!semester || !validSemester(semester) || !periodsContainCourse(course, semester)) return invalid('课程节次不在当前学期作息表内');
  } catch { return unavailable(); }
  const id = update ? course.id! : crypto.randomUUID();
  try {
    const sql = update
      ? 'UPDATE courses SET title=?, teacher=?, location=?, weekday=?, start_period=?, end_period=?, start_week=?, end_week=?, week_type=? WHERE id=?'
      : 'INSERT INTO courses (title, teacher, location, weekday, start_period, end_period, start_week, end_week, week_type, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const result = await context.env.DB.prepare(sql).bind(course.title, course.teacher, course.location, course.weekday, course.startPeriod, course.endPeriod, course.startWeek, course.endWeek, course.weekType, id).run();
    if (update && result.meta?.changes === 0) return Response.json({ error: '课程不存在' }, { status: 404 });
    return Response.json({ ...course, id });
  } catch { return unavailable(); }
}
export const onRequestPost: PagesFunction<AdminEnv, string, AdminData> = context => save(context, false);
export const onRequestPut: PagesFunction<AdminEnv, string, AdminData> = context => save(context, true);
export const onRequestDelete: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let id: unknown;
  try { id = (await context.request.json() as { id?: unknown }).id; } catch { return invalid(); }
  if (typeof id !== 'string' || !id) return invalid();
  try { await context.env.DB.prepare('DELETE FROM courses WHERE id=?').bind(id).run(); return Response.json({ id }); }
  catch { return unavailable(); }
};
