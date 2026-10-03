import { describe, expect, it, vi } from 'vitest';
import { onRequestPost, onRequestPatch, onRequestPut } from './notifications';
import { onRequestGet as getStats } from './notification-stats';
import { onRequestPost as addMember } from './members';

const admin = { cloudflareAccess: { JWT: { payload: { email: 'monitor@stu.xjtu.edu.cn' } } } };
const env = { ADMIN_EMAILS: 'monitor@stu.xjtu.edu.cn' };
const draft = { kind: 'task', priority: 'urgent', title: '提交报名表', body: '周五前提交。', dueAt: '2026-10-02T18:00:00+08:00', pinned: true };
function context(db: unknown, method: string, body: unknown, url = 'https://class.example/api/admin/notifications', authorized = true) {
  return { env: { ...env, DB: db }, data: authorized ? admin : {}, request: new Request(url, { method, body: method === 'GET' ? undefined : JSON.stringify(body) }) } as never;
}
function database(options: { notification?: Record<string, unknown> | null; members?: { email: string }[]; recipients?: Record<string, unknown>[]; updateChanges?: number } = {}) {
  const batch = vi.fn(async (statements: unknown[]) => statements.map(() => ({ success: true })));
  const prepare = vi.fn((sql: string) => ({ bind: (...args: unknown[]) => ({
    first: async () => sql.includes('FROM notifications') ? options.notification ?? null : null,
    all: async () => ({ results: sql.includes('FROM class_members') ? options.members ?? [] : sql.includes('FROM notification_recipients') ? options.recipients ?? [] : [] }),
    run: async () => ({ success: true, meta: { changes: options.updateChanges ?? (sql.includes("status='draft' AND EXISTS") && !options.members?.length ? 0 : 1) } }),
    sql, args
  }), all: async () => ({ results: options.members ?? [] }) }));
  return { prepare, batch };
}

describe('notification publishing', () => {
  it('rejects selected recipients outside the active roster and malformed selections', async () => {
    const db = database({ members: [{ email: 'a@example.com' }] });
    expect((await onRequestPost(context(db, 'POST', { ...draft, recipientEmails: ['unknown@example.com'] }))).status).toBe(400);
    expect((await onRequestPost(context(db, 'POST', { ...draft, recipientEmails: 'all' }))).status).toBe(400);
  });
  it('refuses to publish a draft with no selected recipients or a deactivated recipient', async () => {
    for (const recipient_emails of ['[]', '["gone@example.com"]']) {
      const db = database({ notification: { id: 'n1', status: 'draft', recipient_emails }, members: [{ email: 'a@example.com' }] });
      expect((await onRequestPatch(context(db, 'PATCH', { id: 'n1', action: 'publish' }))).status).toBe(400);
    }
  });
  it('validates the entire bulk roster before writing any entries', async () => {
    const db = database();
    expect((await addMember(context(db, 'POST', { members: [{ displayName: '甲', email: 'a@example.com' }, { displayName: '乙', email: 'bad' }] }))).status).toBe(400);
    expect(db.prepare).not.toHaveBeenCalled();
    expect((await addMember(context(db, 'POST', { members: [{ displayName: '甲', email: 'a@example.com' }, { displayName: '乙', email: 'b@example.com' }] }))).status).toBe(200);
  });
  it('rejects visitors and invalid drafts', async () => {
    const db = database();
    expect((await onRequestPost(context(db, 'POST', draft, undefined, false))).status).toBe(403);
    expect((await onRequestPost(context(db, 'POST', { ...draft, title: '' }))).status).toBe(400);
  });
  it('creates an editable draft but forbids editing a published notification', async () => {
    expect((await onRequestPost(context(database(), 'POST', draft))).status).toBe(200);
    const db = database({ notification: { id: 'n1', status: 'published' } });
    expect((await onRequestPut(context(db, 'PUT', { ...draft, id: 'n1' }))).status).toBe(409);
  });
  it('refuses to publish to an empty roster', async () => {
    const db = database({ notification: { id: 'n1', status: 'draft' }, members: [] });
    expect((await onRequestPatch(context(db, 'PATCH', { id: 'n1', action: 'publish' }))).status).toBe(400);
    expect(db.batch).not.toHaveBeenCalled();
  });
  it('uses one guarded publish update so a trigger snapshots recipients exactly once', async () => {
    const db = database({ notification: { id: 'n1', status: 'draft' }, members: [{ email: 'a@stu.xjtu.edu.cn' }, { email: 'b@stu.xjtu.edu.cn' }] });
    expect((await onRequestPatch(context(db, 'PATCH', { id: 'n1', action: 'publish' }))).status).toBe(200);
    expect(db.batch).not.toHaveBeenCalled();
    expect(db.prepare.mock.calls.some(([sql]) => sql.includes("status='draft' AND EXISTS"))).toBe(true);
  });
  it('reports a concurrent publish as a conflict without adding recipients', async () => {
    const db = database({ notification: { id: 'n1', status: 'draft' }, members: [{ email: 'a@stu.xjtu.edu.cn' }], updateChanges: 0 });
    expect((await onRequestPatch(context(db, 'PATCH', { id: 'n1', action: 'publish' }))).status).toBe(409);
    expect(db.batch).not.toHaveBeenCalled();
  });
  it('reports a draft save as a conflict if publication wins the race', async () => {
    const db = database({ notification: { id: 'n1', status: 'draft' }, updateChanges: 0 });
    expect((await onRequestPut(context(db, 'PUT', { ...draft, id: 'n1' }))).status).toBe(409);
  });
  it('rejects duplicate roster emails after normalizing case', async () => {
    const db = database();
    const result = await addMember(context(db, 'POST', { email: ' A@STU.XJTU.EDU.CN ', displayName: '同学 A' }, 'https://class.example/api/admin/members'));
    expect(result.status).toBe(200);
    expect(db.prepare.mock.calls.some(([sql]) => sql.includes('ON CONFLICT(email)'))).toBe(true);
  });
  it('hides member statistics from visitors and counts fixed recipients for admins', async () => {
    const db = database({ notification: { id: 'n1', kind: 'task', status: 'published' }, recipients: [
      { member_email: 'a@x.edu.cn', display_name: 'A', acknowledged_at: '2026-09-29T12:00:00+08:00', completed_at: null },
      { member_email: 'b@x.edu.cn', display_name: 'B', acknowledged_at: null, completed_at: null }
    ] });
    const url = 'https://class.example/api/admin/notification-stats?id=n1';
    expect((await getStats(context(db, 'GET', null, url, false))).status).toBe(403);
    const response = await getStats(context(db, 'GET', null, url));
    expect(await response.json()).toMatchObject({ total: 2, acknowledged: 1, completed: 0, notAcknowledged: [{ email: 'b@x.edu.cn' }] });
  });
});
