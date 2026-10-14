import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { onRequestPost, onRequestPatch, onRequestPut, onRequestGet, onRequestDelete } from './notifications';
import { onRequestPost as importMembers } from './members';
import { onRequestGet as receipts, onRequestPost as changeReceipt } from '../member/receipt';
import { onRequestGet as stats } from './notification-stats';
import { loadSnapshot } from '../snapshot';
import { onRequestGet as memberPhoto } from '../member/completion-photo';
import { onRequestGet as adminPhoto } from './completion-photo';

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  for (const path of ['db/schema.sql', 'db/migrations/002_notifications.sql', 'db/migrations/003_publish_recipients_trigger.sql', 'db/migrations/004_selected_recipients.sql', 'db/migrations/005_notification_photos.sql', 'db/migrations/006_required_completion_proof.sql', 'db/migrations/007_notification_files.sql']) {
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
  return { sqlite, context, db };
}
const draft = { kind: 'notice', priority: 'normal', title: '通知', body: '内容', dueAt: null, pinned: false };

it('directly withdraws to the same draft and clears receipts in one transaction', async () => {
  const { sqlite, context, db } = setup();
  try {
    const { id } = await (await onRequestPost(context('POST', draft))).json() as { id: string };
    await onRequestPatch(context('PATCH', { id, action: 'publish' }));
    expect((await onRequestPatch(context('PATCH', { id, action: 'withdraw-edit' }))).status).toBe(200);
    expect(sqlite.prepare('SELECT status, body, published_at FROM notifications WHERE id=?').get(id)).toMatchObject({ status: 'draft', body: draft.body, published_at: null });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_recipients WHERE notification_id=?').get(id)?.count).toBe(0);
    expect((await loadSnapshot(db as unknown as D1Database)).notifications).toHaveLength(0);
    expect((await onRequestPatch(context('PATCH', { id, action: 'withdraw-edit' }))).status).toBe(409);
  } finally { sqlite.close(); }
});

it('deletes single records and their receipts at every status while preserving other notifications', async () => {
  const { sqlite, context } = setup();
  sqlite.exec('PRAGMA foreign_keys=ON');
  try {
    const keep = await (await onRequestPost(context('POST', draft))).json() as { id: string };
    for (const status of ['draft', 'published', 'withdrawn']) {
      const { id } = await (await onRequestPost(context('POST', draft))).json() as { id: string };
      if (status !== 'draft') await onRequestPatch(context('PATCH', { id, action: 'publish' }));
      if (status === 'withdrawn') await onRequestPatch(context('PATCH', { id, action: 'withdraw' }));
      expect((await onRequestDelete(context('DELETE', { id }))).status).toBe(200);
      expect(sqlite.prepare('SELECT id FROM notifications WHERE id=?').get(id)).toBeUndefined();
      expect(sqlite.prepare('SELECT notification_id FROM notification_recipients WHERE notification_id=?').get(id)).toBeUndefined();
    }
    expect(sqlite.prepare('SELECT id FROM notifications').all()).toEqual([{ id: keep.id }]);
    expect((await onRequestDelete(context('DELETE', { id: 'missing' }))).status).toBe(404);
    expect((await onRequestDelete({ ...(context('DELETE', { id: keep.id }) as object), data: {} } as never)).status).toBe(403);
  } finally { sqlite.close(); }
});

it('does not withdraw a newer publication or clear its receipts when a previous request is delayed', async () => {
  const { sqlite, context, db } = setup();
  try {
    const { id } = await (await onRequestPost(context('POST', draft))).json() as { id: string };
    await onRequestPatch(context('PATCH', { id, action: 'publish' }));
    const previous = sqlite.prepare('SELECT published_at FROM notifications WHERE id=?').get(id)?.published_at;
    let changed = false;
    const concurrent = { ...db, prepare: (sql: string) => {
      const statement = db.prepare(sql);
      if (!sql.startsWith('SELECT id, status, recipient_emails')) return statement;
      return { ...statement, bind: (...args: never[]) => {
        const bound = statement.bind(...args);
        return { ...bound, first: async () => {
          const row = await bound.first();
          if (!changed) { changed = true; sqlite.prepare("UPDATE notifications SET published_at='2099-01-01T08:00:00+08:00' WHERE id=?").run(id); }
          return row;
        } };
      } };
    } };
    const race = { ...(context('PATCH', { id, action: 'withdraw-edit' }) as unknown as { env: Record<string, unknown> }), env: { DB: concurrent, ADMIN_EMAILS: 'admin@example.com' } } as never;
    expect((await onRequestPatch(race)).status).toBe(409);
    expect(sqlite.prepare('SELECT status FROM notifications WHERE id=?').get(id)?.status).toBe('published');
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_recipients WHERE notification_id=?').get(id)?.count).toBe(2);
    expect((await onRequestPatch(context('PATCH', { id, action: 'withdraw-edit', publishedAt: previous }))).status).toBe(409);
  } finally { sqlite.close(); }
});

it('restores the withdrawn record as a draft with its content and resets receipts before republishing', async () => {
  const { sqlite, context } = setup();
  try {
    const photos = [{ id: 'p1', position: 0, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }];
    const { id } = await (await onRequestPost(context('POST', { ...draft, photos, recipientEmails: ['a@example.com'] }))).json() as { id: string };
    await onRequestPatch(context('PATCH', { id, action: 'publish' }));
    await onRequestPatch(context('PATCH', { id, action: 'withdraw' }));
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_recipients WHERE notification_id=?').get(id)?.count).toBe(1);
    expect((await onRequestPatch(context('PATCH', { id, action: 'restore' }))).status).toBe(200);
    expect(await (await onRequestGet(context('GET'))).json()).toMatchObject([{ id, status: 'draft', body: draft.body, photos, recipientEmails: ['a@example.com'], published_at: null }]);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_recipients WHERE notification_id=?').get(id)?.count).toBe(0);
    expect((await onRequestPatch(context('PATCH', { id, action: 'restore' }))).status).toBe(409);
    expect((await onRequestPatch(context('PATCH', { id, action: 'publish' }))).status).toBe(200);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_recipients WHERE notification_id=?').get(id)?.count).toBe(1);
  } finally { sqlite.close(); }
});

it('deletes expired or withdrawn selections atomically with receipts and refuses active or stale targets', async () => {
  const { sqlite, context } = setup();
  sqlite.exec('PRAGMA foreign_keys=ON');
  try {
    const create = async (body: Omit<typeof draft, 'dueAt'> & { dueAt: string | null } = draft) => {
      const { id } = await (await onRequestPost(context('POST', body))).json() as { id: string };
      await onRequestPatch(context('PATCH', { id, action: 'publish' }));
      return id;
    };
    const old = await create({ ...draft, kind: 'task', dueAt: '2000-01-01T00:00:00+08:00' });
    const withdrawn = await create();
    const active = await create();
    await onRequestPatch(context('PATCH', { id: withdrawn, action: 'withdraw' }));
    expect((await onRequestDelete(context('DELETE', { ids: [withdrawn, active], category: 'withdrawn' }))).status).toBe(409);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_recipients').get()?.count).toBe(6);
    expect((await onRequestDelete(context('DELETE', { ids: [old], category: 'expired' }))).status).toBe(200);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_recipients WHERE notification_id=?').get(old)?.count).toBe(0);
    expect((await onRequestDelete(context('DELETE', { ids: [withdrawn, 'missing'], category: 'withdrawn' }))).status).toBe(409);
    expect((await onRequestDelete(context('DELETE', { ids: [withdrawn], category: 'withdrawn' }))).status).toBe(200);
    expect(sqlite.prepare('SELECT id FROM notifications').all()).toEqual([{ id: active }]);
    expect((await onRequestDelete(context('DELETE', { ids: [active], category: 'expired' }))).status).toBe(409);
    expect((await onRequestDelete(context('DELETE', { ids: [], category: 'withdrawn' }))).status).toBe(400);
    expect((await onRequestDelete({ ...(context('DELETE', { ids: [active], category: 'expired' }) as object), data: {} } as never)).status).toBe(403);
  } finally { sqlite.close(); }
});

it('does not apply a previous publication request after the same ID is restored and republished', async () => {
  for (const action of ['ack', 'complete', 'undoComplete']) {
    const { sqlite, context, db } = setup();
    try {
      const { id } = await (await onRequestPost(context('POST', { ...draft, kind: 'task', dueAt: '2099-01-01T00:00:00+08:00' }))).json() as { id: string };
      await onRequestPatch(context('PATCH', { id, action: 'publish' }));
      sqlite.prepare('UPDATE notifications SET published_at=? WHERE id=?').run('2000-01-01T00:00:00+08:00', id);
      const racedDb = { ...db, prepare: (sql: string) => {
        const statement = db.prepare(sql);
        if (!sql.startsWith('SELECT n.id')) return statement;
        return { ...statement, bind: (...args: never[]) => {
          const bound = statement.bind(...args);
          return { ...bound, first: async () => {
            const row = await bound.first();
            await onRequestPatch(context('PATCH', { id, action: 'withdraw' }));
            await onRequestPatch(context('PATCH', { id, action: 'restore' }));
            await onRequestPatch(context('PATCH', { id, action: 'publish' }));
            sqlite.prepare('UPDATE notification_recipients SET completed_at=? WHERE notification_id=?').run('new completion', id);
            return row;
          } };
        } };
      } };
      const memberContext = { env: { DB: racedDb }, data: { member: { email: 'a@example.com', displayName: '甲' } }, request: new Request('https://example.com/api/member/receipt', { method: 'POST', body: JSON.stringify({ notificationId: id, action }) }) } as never;
      expect((await changeReceipt(memberContext)).status).toBe(409);
      expect(sqlite.prepare('SELECT completed_at FROM notification_recipients WHERE notification_id=? AND member_email=?').get(id, 'a@example.com')?.completed_at).toBe('new completion');
    } finally { sqlite.close(); }
  }
});

it('supports deleting a whole category containing more than 500 records', async () => {
  const { sqlite, context } = setup();
  try {
    const ids = Array.from({ length: 501 }, (_, index) => `bulk-${index}`);
    const insert = sqlite.prepare("INSERT INTO notifications (id, kind, priority, title, body, status, author_email, created_at) VALUES (?, 'notice', 'normal', '旧通知', '正文', 'withdrawn', 'admin@example.com', '2000-01-01')");
    for (const id of ids) insert.run(id);
    expect((await onRequestDelete(context('DELETE', { ids, category: 'withdrawn' }))).status).toBe(200);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notifications').get()?.count).toBe(0);
  } finally { sqlite.close(); }
});

it('keeps editable draft content but excludes historical photo payloads from the records list', async () => {
  const { sqlite, context } = setup();
  try {
    const photos = [{ id: 'p1', position: 0, dataUrl: `data:image/png;base64,iVBORw0KGgoA${'A'.repeat(200000)}` }];
    const { id } = await (await onRequestPost(context('POST', { ...draft, photos, recipientEmails: ['a@example.com'] }))).json() as { id: string };
    const editable = await (await onRequestGet(context('GET'))).json() as { photos: unknown[] }[];
    expect(editable).toMatchObject([{ body: draft.body, recipientEmails: ['a@example.com'] }]);
    expect(JSON.stringify(editable[0].photos) === JSON.stringify(photos)).toBe(true);
    for (const action of ['publish', 'withdraw']) {
      await onRequestPatch(context('PATCH', { id, action }));
      const response = await onRequestGet(context('GET'));
      const text = await response.text();
      expect(text.length).toBeLessThan(2000);
      expect(JSON.parse(text)).toMatchObject([{ id, title: draft.title, photos: [], body: '', recipientEmails: null }]);
      expect(sqlite.prepare('SELECT photos FROM notifications WHERE id=?').get(id)?.photos === JSON.stringify(photos)).toBe(true);
    }
    const unauthorized = { ...(context('GET') as object), data: {} } as never;
    expect((await onRequestGet(unauthorized)).status).toBe(403);
  } finally { sqlite.close(); }
});

it('orders by publication rather than draft creation, importance or pinned status', async () => {
  const { sqlite, context, db } = setup();
  try {
    const newer = await (await onRequestPost(context('POST', { ...draft, title: '后发布的普通通知' }))).json() as { id: string };
    const older = await (await onRequestPost(context('POST', { ...draft, title: '先发布的置顶紧急通知', pinned: true, priority: 'urgent' }))).json() as { id: string };
    await onRequestPatch(context('PATCH', { id: older.id, action: 'publish' }));
    await onRequestPatch(context('PATCH', { id: newer.id, action: 'publish' }));
    sqlite.prepare('UPDATE notifications SET created_at=?, published_at=? WHERE id=?').run('2026-10-05T09:00:00+08:00', '2026-10-05T11:00:00+08:00', newer.id);
    sqlite.prepare('UPDATE notifications SET created_at=?, published_at=? WHERE id=?').run('2026-10-05T09:30:00+08:00', '2026-10-05T10:00:00+08:00', older.id);
    expect((await loadSnapshot(db as unknown as D1Database)).notifications.map(item => item.id)).toEqual([newer.id, older.id]);
    const records = await (await onRequestGet(context('GET'))).json() as { id: string }[];
    expect(records.map(item => item.id)).toEqual([newer.id, older.id]);
  } finally { sqlite.close(); }
});

it('persists the task proof requirement through draft editing and publication and enforces it for recipients', async () => {
  const { sqlite, context, db } = setup();
  const body = { ...draft, kind: 'task', dueAt: '2026-10-05T18:00:00+08:00', requiresCompletionProof: true };
  const memberContext = (id: string, photos?: unknown) => ({ env: { DB: db }, data: { member: { email: 'a@example.com', displayName: '甲' } }, request: new Request('https://example.com/api/member/receipt', { method: 'POST', body: JSON.stringify({ notificationId: id, action: 'complete', photos }) }) }) as never;
  try {
    const response = await onRequestPost(context('POST', body));
    expect(response.status).toBe(200);
    const { id } = await response.json() as { id: string };
    expect(await (await onRequestGet(context('GET'))).json()).toMatchObject([{ requiresCompletionProof: true }]);
    expect((await onRequestPut(context('PUT', { ...body, id, requiresCompletionProof: false }))).status).toBe(200);
    expect(await (await onRequestGet(context('GET'))).json()).toMatchObject([{ requiresCompletionProof: false }]);
    await onRequestPut(context('PUT', { ...body, id }));
    await onRequestPatch(context('PATCH', { id, action: 'publish' }));
    expect((await loadSnapshot(db as unknown as D1Database)).notifications).toMatchObject([{ requiresCompletionProof: true }]);
    expect((await changeReceipt(memberContext(id, []))).status).toBe(400);
    expect(sqlite.prepare('SELECT completed_at FROM notification_recipients WHERE notification_id=? AND member_email=?').get(id, 'a@example.com')?.completed_at).toBeNull();
    expect((await changeReceipt(memberContext(id, [{ id: 'proof', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }]))).status).toBe(200);
    // An undo in another tab must not let a stale retry recreate completion without proof.
    const racedDb = { ...db, prepare: (sql: string) => {
      const statement = db.prepare(sql);
      if (!sql.startsWith('SELECT n.id')) return statement;
      return { ...statement, bind: (...args: never[]) => {
        const bound = statement.bind(...args);
        return { ...bound, first: async () => {
          const row = await bound.first();
          sqlite.prepare("UPDATE notification_recipients SET completed_at=NULL, completion_photos='[]' WHERE notification_id=? AND member_email=?").run(id, 'a@example.com');
          return row;
        } };
      } };
    } };
    const retryContext = { ...(memberContext(id, []) as object), env: { DB: racedDb } } as never;
    expect((await changeReceipt(retryContext)).status).toBe(409);
    expect(sqlite.prepare('SELECT completed_at FROM notification_recipients WHERE notification_id=? AND member_email=?').get(id, 'a@example.com')?.completed_at).toBeNull();
    // Published requirements are immutable through the draft endpoint.
    expect((await onRequestPut(context('PUT', { ...body, id, requiresCompletionProof: false }))).status).toBe(409);
  } finally { sqlite.close(); }
});

it('persists inline notice photos and keeps completion photos private, including after undo and retry', async () => {
  const { sqlite, context, db } = setup();
  const photo = { id: 'notice-photo', position: 1, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
  const proof = { id: 'proof-photo', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
  const memberContext = (email: string, body?: unknown) => ({ env: { DB: db }, data: { member: { email, displayName: email } }, request: new Request('https://example.com/api/member/receipt', { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined }) }) as never;
  try {
    const created = await onRequestPost(context('POST', { ...draft, kind: 'task', dueAt: '2026-10-05T18:00:00+08:00', photos: [photo] }));
    expect(created.status).toBe(200);
    const { id } = await created.json() as { id: string };
    expect((await onRequestPatch(context('PATCH', { id, action: 'publish' }))).status).toBe(200);
    expect((await loadSnapshot(db as unknown as D1Database)).notifications[0]).toMatchObject({ photos: [photo] });
    expect((await changeReceipt(memberContext('a@example.com', { notificationId: id, action: 'complete', photos: [proof] }))).status).toBe(200);
    // A repeated completion must not overwrite an already submitted photo.
    await changeReceipt(memberContext('a@example.com', { notificationId: id, action: 'complete', photos: [] }));
    const own = await (await receipts(memberContext('a@example.com'))).json();
    expect(own).toMatchObject([{ photos: [{ id: 'proof-photo', dataUrl: `/api/member/completion-photo?notificationId=${id}&photoId=proof-photo` }] }]);
    expect(JSON.stringify(await (await receipts(memberContext('b@example.com'))).json())).not.toContain('proof-photo');
    expect(JSON.stringify(await loadSnapshot(db as unknown as D1Database))).not.toContain('proof-photo');
    const photoContext = (email: string) => ({ ...(memberContext(email) as object), request: new Request(`https://example.com/api/member/completion-photo?notificationId=${id}&photoId=proof-photo&email=a@example.com`) }) as never;
    const image = await memberPhoto(photoContext('a@example.com'));
    expect(image.status).toBe(200);
    expect(image.headers.get('Content-Type')).toBe('image/png');
    expect(image.headers.get('Cache-Control')).toBe('private, no-store');
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    // Passing another student's email in the URL cannot change the authenticated owner.
    expect((await memberPhoto(photoContext('b@example.com'))).status).toBe(404);
    expect((await memberPhoto({ ...(photoContext('a@example.com') as object), data: {} } as never)).status).toBe(403);
    const adminImageContext = { ...(context('GET') as object), request: new Request(`https://example.com/api/admin/completion-photo?notificationId=${id}&photoId=proof-photo&email=a@example.com`) } as never;
    expect((await adminPhoto(adminImageContext)).status).toBe(200);
    expect((await adminPhoto({ ...(adminImageContext as object), data: {} } as never)).status).toBe(403);
    const adminContext = { ...(context('GET') as object), request: new Request(`https://example.com/api/admin/notification-stats?id=${id}`) } as never;
    expect(await (await stats(adminContext)).json()).toMatchObject({ completedRecipients: [{ email: 'a@example.com', photos: [{ id: 'proof-photo', dataUrl: `/api/admin/completion-photo?notificationId=${id}&email=a%40example.com&photoId=proof-photo` }] }] });
    await changeReceipt(memberContext('a@example.com', { notificationId: id, action: 'undoComplete' }));
    expect(await (await receipts(memberContext('a@example.com'))).json()).toMatchObject([{ completedAt: null, photos: [] }]);
    expect((await memberPhoto(photoContext('a@example.com'))).status).toBe(404);
    expect((await adminPhoto(adminImageContext)).status).toBe(404);
  } finally { sqlite.close(); }
});

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
