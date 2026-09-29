import { describe, expect, it, vi } from 'vitest';
import { onRequest as middleware } from './_middleware';
import { onRequestGet as session } from './session';
import { onRequestGet as receipts, onRequestPost as changeReceipt } from './receipt';
import { onRequestGet as login } from './login';

const email = 'student@stu.xjtu.edu.cn';
function fakeDb(options: { roster?: boolean; recipient?: boolean; status?: string; kind?: string } = {}) {
  const prepare = vi.fn((sql: string) => ({ bind: (...args: unknown[]) => ({
    first: async () => sql.includes('FROM class_members') ? (options.roster ? { email, display_name: '同学甲', active: 1 } : null) :
      sql.includes('FROM notifications') ? (options.recipient ? { id: 'n1', kind: options.kind ?? 'task', status: options.status ?? 'published', member_email: email } : null) : null,
    all: async () => ({ results: sql.includes('FROM notification_recipients') ? [{ notification_id: 'n1', acknowledged_at: null, completed_at: null }] : [] }),
    run: async () => ({ success: true, meta: { changes: 1 } }), sql, args
  }) }));
  return { prepare };
}
const data = { member: { email, displayName: '同学甲' } };
function ctx(db: unknown, method: string, body?: unknown, authorized = true) {
  return { env: { DB: db }, data: authorized ? data : {}, request: new Request('https://class.example/api/member/receipt', { method, body: method === 'GET' ? undefined : JSON.stringify(body) }) } as never;
}

describe('member identity and receipts', () => {
  it('requires a local test token and a roster match', async () => {
    const env = { DB: fakeDb({ roster: true }), LOCAL_DEV_MODE: 'true', LOCAL_DEV_MEMBER_EMAIL: email, LOCAL_DEV_MEMBER_TOKEN: 'member-test' };
    const next = vi.fn(async () => new Response('ok'));
    const build = (cookie: string) => ({ env, data: {}, request: new Request('http://127.0.0.1:8788/api/member/session', { headers: { Cookie: cookie } }), next });
    expect((await middleware[0](build('') as never) as Response).status).toBe(403);
    const valid = build('local_member=member-test');
    expect((await middleware[0](valid as never) as Response).status).toBe(200);
    expect((await middleware[1](valid as never) as Response).status).toBe(200);
    const nonmember = { ...valid, env: { ...env, DB: fakeDb({ roster: false }) } };
    expect((await middleware[1](nonmember as never) as Response).status).toBe(403);
  });
  it('returns only the current member identity and receipt rows', async () => {
    const db = fakeDb();
    expect((await session(ctx(db, 'GET')) as Response).status).toBe(200);
    await expect((await receipts(ctx(db, 'GET')) as Response).json()).resolves.toMatchObject([{ notificationId: 'n1' }]);
    expect((await receipts(ctx(db, 'GET', undefined, false)) as Response).status).toBe(403);
  });
  it('cannot acknowledge a notice outside this member’s published recipients', async () => {
    expect((await changeReceipt(ctx(fakeDb({ recipient: false }), 'POST', { notificationId: 'n1', action: 'ack' })) as Response).status).toBe(404);
    expect((await changeReceipt(ctx(fakeDb({ recipient: true, status: 'withdrawn' }), 'POST', { notificationId: 'n1', action: 'ack' })) as Response).status).toBe(409);
  });
  it('acknowledges idempotently; completing also acknowledges and can be undone', async () => {
    const db = fakeDb({ recipient: true });
    for (const action of ['ack', 'ack', 'complete', 'undoComplete']) expect((await changeReceipt(ctx(db, 'POST', { notificationId: 'n1', action })) as Response).status).toBe(200);
    const statements = db.prepare.mock.calls.map(([sql]) => sql);
    expect(statements.some(sql => sql.includes('acknowledged_at=COALESCE'))).toBe(true);
    expect(statements.some(sql => sql.includes('completed_at=NULL'))).toBe(true);
  });
  it('does not complete an ordinary announcement', async () => {
    expect((await changeReceipt(ctx(fakeDb({ recipient: true, kind: 'notice' }), 'POST', { notificationId: 'n1', action: 'complete' })) as Response).status).toBe(400);
  });
  it('sends the browser back to notifications after email login', async () => {
    const response = await login({ request: new Request('https://class.example/api/member/login') } as never);
    expect(response.headers.get('Location')).toBe('https://class.example/?view=notifications');
  });
});
