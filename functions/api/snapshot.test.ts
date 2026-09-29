import { expect, it, vi } from 'vitest';
import { onRequestGet } from './snapshot';

function db(rows: Record<string, Record<string, unknown>[]>) {
  return { prepare: (sql: string) => ({ bind: () => ({ all: async () => ({ results: rows[sql] ?? [] }) }), all: async () => ({ results: rows[sql] ?? [] }) }) };
}

it('returns public semester, courses and events without admin fields', async () => {
  const database = db({
    'SELECT key, value FROM settings': [{ key: 'semester', value: JSON.stringify({ title: '秋季', startDate: '2026-09-01', endDate: '2027-01-01', periods: [] }), adminSecret: 'private' }, { key: 'demo', value: 'true' }],
    'SELECT * FROM courses ORDER BY weekday, start_period': [{ id: '1', title: '高数', teacher: '张', location: 'A1', weekday: 1, start_period: 1, end_period: 2, start_week: 1, end_week: 16, week_type: 'all' }],
    'SELECT * FROM events ORDER BY due_at': [{ id: 'e', title: '班会', description: '', category: '班级', start_at: '2026-09-01T10:00:00+08:00', due_at: '2026-09-01T11:00:00+08:00', done: 0 }]
  });
  const response = await onRequestGet({ env: { DB: database }, request: new Request('https://example.com/api/snapshot') } as never);
  const body = await response.json() as Record<string, unknown>;
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(body).toMatchObject({ courses: [{ title: '高数' }], events: [{ title: '班会' }], demo: true });
  expect(JSON.stringify(body)).not.toContain('adminSecret');
});

it('returns an empty snapshot when the database has no rows', async () => {
  const response = await onRequestGet({ env: { DB: db({}) }, request: new Request('https://example.com/api/snapshot') } as never);
  expect(response.status).toBe(200);
  expect((await response.json() as { courses: unknown[] }).courses).toEqual([]);
  await expect((await onRequestGet({ env: { DB: db({}) }, request: new Request('https://example.com/api/snapshot') } as never)).json()).resolves.toMatchObject({ demo: false });
});

it('returns 503 on database errors', async () => {
  const broken = { prepare: vi.fn(() => { throw Error('db down'); }) };
  const response = await onRequestGet({ env: { DB: broken }, request: new Request('https://example.com/api/snapshot') } as never);
  expect(response.status).toBe(503);
});

it('returns only public fields of published notifications', async () => {
  const database = db({
    'SELECT * FROM notifications WHERE status = ? ORDER BY pinned DESC, published_at DESC': [{ id: 'n1', kind: 'notice', priority: 'urgent', title: '重要通知', body: '请查收', due_at: null, pinned: 1, status: 'published', published_at: '2026-09-29T10:00:00+08:00', author_email: 'monitor@stu.xjtu.edu.cn', private_token: 'secret' }]
  });
  const response = await onRequestGet({ env: { DB: database }, request: new Request('https://example.com/api/snapshot') } as never);
  const body = await response.json() as { notifications: Record<string, unknown>[] };
  expect(body.notifications).toMatchObject([{ id: 'n1', title: '重要通知', pinned: true }]);
  expect(JSON.stringify(body.notifications)).not.toContain('author_email');
  expect(JSON.stringify(body.notifications)).not.toContain('private_token');
});
