import { expect, it, vi } from 'vitest';
import { onRequestGet } from './calendar.ics';

function context(query = '', broken = false) {
  const rows = [{ id: 'event-a', title: '班会', description: '教室集合', category: '班级', start_at: '2026-10-20T18:00:00+08:00', due_at: '2026-10-20T19:00:00+08:00', done: 0 }, { id: 'event-b', title: '已完成', description: '', category: '', start_at: '2026-10-01T18:00:00+08:00', due_at: '2026-10-01T19:00:00+08:00', done: 1 }];
  const db = { prepare: vi.fn((sql: string) => {
    if (broken) throw Error('db down');
    const all = async () => ({ results: sql.includes('settings') ? [{ key: 'className', value: '班务' }] : sql.includes('events') ? rows : [] });
    return { all, bind: () => ({ all }) };
  }) };
  return { env: { DB: db }, request: new Request('https://class.example.com/api/calendar.ics' + query) } as never;
}

it('serves a public subscription with only unfinished events and no private notification data', async () => {
  const response = await onRequestGet(context());
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
  expect(response.headers.get('Content-Disposition')).toContain('inline;');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const calendar = await response.text();
  expect(calendar).toContain('SUMMARY:班会');
  expect(calendar).not.toContain('SUMMARY:已完成');
});

it('exports exactly the selected event, including historical events, as a named download', async () => {
  const response = await onRequestGet(context('?event=event-b&download=1'));
  expect(response.headers.get('Content-Disposition')).toContain('attachment;');
  expect(response.headers.get('Content-Disposition')).toContain('.ics');
  const calendar = await response.text();
  expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(calendar).toContain('SUMMARY:已完成');
});

it('returns an empty subscription after single-event deletion, never the whole class feed', async () => {
  const response = await onRequestGet(context('?event=missing'));
  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain('BEGIN:VEVENT');
  expect((await onRequestGet(context('?event=missing&download=1'))).status).toBe(404);
  expect((await onRequestGet(context('?event='))).status).toBe(400);
});

it('returns 503 for unavailable calendar data', async () => {
  expect((await onRequestGet(context('', true))).status).toBe(503);
});
