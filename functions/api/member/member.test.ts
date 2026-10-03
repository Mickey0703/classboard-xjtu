import { describe, expect, it, vi } from 'vitest';
import { onRequest as middleware } from './_middleware';
import { onRequestGet as session } from './session';
import { onRequestGet as receipts, onRequestPost as changeReceipt } from './receipt';
import { onRequestGet as login } from './login';

const email = 'student@stu.xjtu.edu.cn';
function fakeDb(options: { roster?: boolean; recipient?: boolean; status?: string; kind?: string; updateChanges?: number; requiresProof?: boolean; completedAt?: string | null } = {}) {
  const prepare = vi.fn((sql: string) => ({ bind: (...args: unknown[]) => ({
    first: async () => sql.includes('FROM class_members') ? (options.roster ? { email, display_name: '同学甲', active: 1 } : null) :
      sql.includes('FROM notifications') ? (options.recipient ? { id: 'n1', kind: options.kind ?? 'task', status: options.status ?? 'published', member_email: email, requires_completion_proof: options.requiresProof ? 1 : 0, completed_at: options.completedAt ?? null } : null) : null,
    all: async () => ({ results: sql.includes('FROM notification_recipients') ? [{ notification_id: 'n1', acknowledged_at: null, completed_at: null }] : [] }),
    run: async () => ({ success: true, meta: { changes: options.updateChanges ?? 1 } }), sql, args
  }) }));
  return { prepare };
}
const data = { member: { email, displayName: '同学甲' } };
function ctx(db: unknown, method: string, body?: unknown, authorized = true) {
  return { env: { DB: db }, data: authorized ? data : {}, request: new Request('https://class.example/api/member/receipt', { method, body: method === 'GET' ? undefined : JSON.stringify(body) }) } as never;
}

describe('member identity and receipts', () => {
  it('enforces proof on the server but still allows acknowledgement and undo', async () => {
    for (const photos of [undefined, []]) {
      const db = fakeDb({ recipient: true, requiresProof: true });
      const response = await changeReceipt(ctx(db, 'POST', { notificationId: 'n1', action: 'complete', photos }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: '请添加完成照片或截图后确认完成' });
      expect(db.prepare.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
    }
    for (const action of ['ack', 'undoComplete']) {
      expect((await changeReceipt(ctx(fakeDb({ recipient: true, requiresProof: true }), 'POST', { notificationId: 'n1', action }))).status).toBe(200);
    }
    const photos = [{ id: 'p1', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }];
    expect((await changeReceipt(ctx(fakeDb({ recipient: true, requiresProof: true }), 'POST', { notificationId: 'n1', action: 'complete', photos }))).status).toBe(200);
    expect((await changeReceipt(ctx(fakeDb({ recipient: true, requiresProof: true, completedAt: 'already completed' }), 'POST', { notificationId: 'n1', action: 'complete', photos: [] }))).status).toBe(200);
  });
  it('rejects non-image and oversized completion photos without writing a receipt', async () => {
    for (const photos of [[{ id: 'p1', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }], [{ id: 'p1', dataUrl: 'data:image/png;base64,' + 'A'.repeat(400001) }], 'bad']) {
      const db = fakeDb({ recipient: true });
      expect((await changeReceipt(ctx(db, 'POST', { notificationId: 'n1', action: 'complete', photos }))).status).toBe(400);
      expect(db.prepare).not.toHaveBeenCalled();
    }
  });
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
  it('does not write a receipt if the notice is withdrawn after its initial read', async () => {
    const db = fakeDb({ recipient: true, status: 'published', updateChanges: 0 });
    const response = await changeReceipt(ctx(db, 'POST', { notificationId: 'n1', action: 'ack' }));
    expect(response.status).toBe(409);
    expect(db.prepare.mock.calls.some(([sql]) => sql.includes("status='published'"))).toBe(true);
  });
  it('sends the browser back to notifications after email login', async () => {
    const response = await login({ request: new Request('https://class.example/api/member/login') } as never);
    expect(response.headers.get('Location')).toBe('https://class.example/?view=notifications');
  });
});
