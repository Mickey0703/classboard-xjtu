import { describe, expect, it, vi } from 'vitest';
import { isAdminEmail, requireAdmin } from './auth';
import { onRequestPost as createCourse, onRequestPut as updateCourse } from './courses';
import { onRequestPost as createEvent } from './events';

const statement = { bind: vi.fn(() => ({ run: vi.fn(async () => ({ success: true })) })) };
const db = { prepare: vi.fn(() => statement) };
const env = { DB: db, ADMIN_EMAILS: 'monitor@stu.xjtu.edu.cn' };
const course = { title: '高等数学', teacher: '张老师', location: 'A101', weekday: 1, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16, weekType: 'all' };
function context(body: unknown, email?: string) {
  return { env, request: new Request('https://example.com/api/admin/courses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), data: email ? { cloudflareAccess: { JWT: { payload: { email } } } } : {} } as never;
}

describe('admin protection', () => {
  it('denies missing and non-allowlisted identities', () => {
    expect(isAdminEmail(undefined, env.ADMIN_EMAILS)).toBe(false);
    expect(isAdminEmail('other@example.com', env.ADMIN_EMAILS)).toBe(false);
    expect(requireAdmin(context(course))).toBe(false);
  });
  it('permits an allowlisted email regardless of case', () => {
    expect(isAdminEmail('MONITOR@stu.xjtu.edu.cn', env.ADMIN_EMAILS)).toBe(true);
  });
  it('rejects writes without a verified admin context', async () => {
    expect((await createCourse(context(course))).status).toBe(403);
    expect(db.prepare).not.toHaveBeenCalled();
  });
  it('rejects invalid course and event fields', async () => {
    expect((await createCourse(context({ ...course, weekday: 9 }, 'monitor@stu.xjtu.edu.cn'))).status).toBe(400);
    expect((await createEvent(context({ title: '作业', startAt: 'bad', dueAt: 'bad' }, 'monitor@stu.xjtu.edu.cn'))).status).toBe(400);
  });
  it('saves a valid course and requires an id for updates', async () => {
    expect((await createCourse(context(course, 'monitor@stu.xjtu.edu.cn'))).status).toBe(200);
    expect(db.prepare).toHaveBeenCalled();
    expect((await updateCourse(context(course, 'monitor@stu.xjtu.edu.cn'))).status).toBe(400);
  });
});
