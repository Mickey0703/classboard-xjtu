import type { Semester } from '../../../src/domain/types';
import { denied, invalid, requireAdmin, unavailable, type AdminData, type AdminEnv } from './auth';
import { periodsContainCourse, validSemester } from './validate';

export const onRequestPut: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let semester: Partial<Semester>;
  try { semester = await context.request.json() as Partial<Semester>; } catch { return invalid(); }
  if (!validSemester(semester)) return invalid();
  try {
    const existing = await context.env.DB.prepare('SELECT start_period, end_period FROM courses').all<{ start_period: number; end_period: number }>();
    if ((existing.results ?? []).some(course => !periodsContainCourse({ startPeriod: course.start_period, endPeriod: course.end_period }, semester))) return invalid('部分课程仍使用将被移除的节次');
    await context.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('semester', JSON.stringify(semester)).run();
    return Response.json(semester);
  } catch { return unavailable(); }
};
