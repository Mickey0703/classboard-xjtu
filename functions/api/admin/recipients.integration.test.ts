import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { onRequestPost, onRequestPatch, onRequestPut, onRequestGet } from './notifications';
import { onRequestPost as importMembers } from './members';

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  for (const path of ['db/schema.sql', 'db/migrations/002_notifications.sql', 'db/migrations/003_publish_recipients_trigger.sql', 'db/migrations/004_selected_recipients.sql']) {
    sqlite.exec(readFileSync(path, 'utf8'));
  }
  const prepare = (sql: string) => {
    const statement = sqlite.prepare(sql);
    const bound = (args: never[]) => ({
      first: async () => statement.get(...args) ?? null,
      all: async () => ({ results: statement.all(...args) }),
      run: async () => ({ success: true, meta: { changes: Number(statement.run(...args).changes) } })
    });
    return { ...bound([]), bind: (...args: never[]) => bound(args) };
  };
  const db = { prepare, batch: async (statements: { run: () => Promise<unknown> }[]) => {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  const context = (method: string, body?: unknown) => ({ env: { DB: db, ADMIN_EMAILS: 'admin@example.com' }, data: { cloudflareAccess: { JWT: { payload: { email: 'admin@example.com' } } } }, request: new Request('https://example.com/api/admin/notifications', { method, body: body === undefined ? undefined : JSON.stringify(body) }) }) as never;
  sqlite.exec("INSERT INTO class_members VALUES ('a@example.com', '甲', 1), ('b@example.com', '乙', 1), ('c@example.com', '丙', 0)");
  return { sqlite, context };
}
const draft = { kind: 'notice', priority: 'normal', title: '通知', body: '内容', dueAt: null, pinned: false };

it('persists selected draft recipients and snapshots only those recipients once', async () => {
  const { sqlite, context } = setup();
  try {
    const response = await onRequestPost(context('POST', { ...draft, recipientEmails: ['a@example.com'] }));
    expect(response.status).toBe(200);
    const { id } = await response.json() as { id: string };
    const list = await (await onRequestGet(context('GET'))).json() as { recipientEmails: string[] }[];
    expect(list[0].recipientEmails).toEqual(['a@example.com']);
    expect((await onRequestPatch(context('PATCH', { id, action: 'publish' }))).status).toBe(200);
    expect(sqlite.prepare('SELECT member_email FROM notification_recipients').all()).toEqual([{ member_email: 'a@example.com' }]);
    expect((await onRequestPatch(context('PATCH', { id, action: 'publish' }))).status).toBe(409);
    sqlite.exec("UPDATE class_members SET active=0 WHERE email='a@example.com'");
    expect(sqlite.prepare('SELECT count(*) AS total FROM notification_recipients').get()?.total).toBe(1);
  } finally { sqlite.close(); }
});

it('saves changed selections and blocks publication after a selected member is deactivated', async () => {
  const { sqlite, context } = setup();
  try {
    const { id } = await (await onRequestPost(context('POST', { ...draft, recipientEmails: ['a@example.com'] }))).json() as { id: string };
    expect((await onRequestPut(context('PUT', { ...draft, id, recipientEmails: ['b@example.com'] }))).status).toBe(200);
    sqlite.exec("UPDATE class_members SET active=0 WHERE email='b@example.com'");
    expect((await onRequestPatch(context('PATCH', { id, action: 'publish' }))).status).toBe(400);
    expect(sqlite.prepare('SELECT count(*) AS total FROM notification_recipients').get()?.total).toBe(0);
  } finally { sqlite.close(); }
});

it('bulk imports normalized entries without removing existing members and rejects duplicate emails', async () => {
  const { sqlite, context } = setup();
  try {
    const members = [{ displayName: '更新甲', email: ' A@EXAMPLE.COM ' }, { displayName: '丁', email: 'd@example.com' }];
    expect((await importMembers(context('POST', { members }))).status).toBe(200);
    expect(sqlite.prepare('SELECT display_name FROM class_members WHERE email=?').get('a@example.com')?.display_name).toBe('更新甲');
    expect(sqlite.prepare('SELECT count(*) AS total FROM class_members').get()?.total).toBe(4);
    expect((await importMembers(context('POST', { members: [...members, { displayName: '重复', email: 'a@example.com' }] }))).status).toBe(400);
  } finally { sqlite.close(); }
});
