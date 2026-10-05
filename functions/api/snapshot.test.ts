import { expect, it, vi } from 'vitest';
import { onRequestGet } from './snapshot';

function db(rows: Record<string, Record<string, unknown>[]>) {
  return { prepare: (sql: string) => ({ bind: () => ({ all: async () => ({ results: rows[sql] ?? [] }) }), all: async () => ({ results: rows[sql] ?? [] }) }) };
}

it('returns class branding, events and published notices without course or private fields', async () => {
  const database = db({
    'SELECT key, value FROM settings': [{ key: 'className', value: 'ID 2601 班务' }, { key: 'demo', value: 'true' }, { key: 'semester', value: 'legacy' }],
    'SELECT * FROM events ORDER BY due_at': [{ id: 'e', title: '班会', description: '', category: '班级', start_at: '2026-09-29T18:00:00+08:00', due_at: '2026-09-29T19:00:00+08:00', done: 0 }],
    'SELECT * FROM notifications WHERE status = ? ORDER BY published_at DESC, id DESC': [{ id: 'n', kind: 'notice', priority: 'urgent', title: '通知', body: '请查看', due_at: null, pinned: 1, published_at: '2026-09-29T10:00:00+08:00', author_email: 'private@example.com' }]
  });
  const response = await onRequestGet({ env: { DB: database }, request: new Request('https://example.com/api/snapshot') } as never);
  const body = await response.json() as Record<string, unknown>;
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(body).toMatchObject({ className: 'ID 2601 班务', events: [{ title: '班会' }], notifications: [{ title: '通知' }], demo: true });
  expect(body).not.toHaveProperty('courses');
  expect(body).not.toHaveProperty('semester');
  expect(JSON.stringify(body)).not.toContain('author_email');
});

it('uses a default class name and empty lists for an unconfigured database', async () => {
  const response = await onRequestGet({ env: { DB: db({}) }, request: new Request('https://example.com/api/snapshot') } as never);
  expect(await response.json()).toMatchObject({ className: '西交班务', events: [], notifications: [], demo: false });
});

it('returns 503 on database errors', async () => {
  const broken = { prepare: vi.fn(() => { throw Error('db down'); }) };
  const response = await onRequestGet({ env: { DB: broken }, request: new Request('https://example.com/api/snapshot') } as never);
  expect(response.status).toBe(503);
});
