import { expect, it, vi } from 'vitest';
import { onRequestGet } from './snapshot';

function db(rows: Record<string, Record<string, unknown>[]>) {
  return { prepare: (sql: string) => ({ all: async () => ({ results: rows[sql] ?? [] }) }) };
}

it('returns public semester, courses and events without admin fields', async () => {
  const database = db({
    'SELECT key, value FROM settings': [{ key: 'semester', value: JSON.stringify({ title: '秋季', startDate: '2026-09-01', endDate: '2027-01-01', periods: [] }), adminSecret: 'private' }],
    'SELECT * FROM courses ORDER BY weekday, start_period': [{ id: '1', title: '高数', teacher: '张', location: 'A1', weekday: 1, start_period: 1, end_period: 2, start_week: 1, end_week: 16, week_type: 'all' }],
    'SELECT * FROM events ORDER BY due_at': [{ id: 'e', title: '班会', description: '', category: '班级', start_at: '2026-09-01T10:00:00+08:00', due_at: '2026-09-01T11:00:00+08:00', done: 0 }]
  });
  const response = await onRequestGet({ env: { DB: database }, request: new Request('https://example.com/api/snapshot') } as never);
  const body = await response.json() as Record<string, unknown>;
  expect(response.status).toBe(200);
  expect(body).toMatchObject({ courses: [{ title: '高数' }], events: [{ title: '班会' }], demo: true });
  expect(JSON.stringify(body)).not.toContain('adminSecret');
});

it('returns an empty snapshot when the database has no rows', async () => {
  const response = await onRequestGet({ env: { DB: db({}) }, request: new Request('https://example.com/api/snapshot') } as never);
  expect(response.status).toBe(200);
  expect((await response.json() as { courses: unknown[] }).courses).toEqual([]);
});

it('returns 503 on database errors', async () => {
  const broken = { prepare: vi.fn(() => { throw Error('db down'); }) };
  const response = await onRequestGet({ env: { DB: broken }, request: new Request('https://example.com/api/snapshot') } as never);
  expect(response.status).toBe(503);
});
