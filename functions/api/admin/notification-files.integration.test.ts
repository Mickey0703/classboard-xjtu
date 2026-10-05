// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { downloadFile } from '../attachment-helpers';
import { onRequestPost as upload } from './notification-files';
import { onRequestPost as create, onRequestPut as edit, onRequestPatch as transition, onRequestGet as list } from './notifications';
import { onRequestGet as publicFile } from '../notification-file';
import { onRequestGet as adminFile } from './notification-file';
import { loadSnapshot } from '../snapshot';

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  for (const path of ['db/schema.sql', ...['002_notifications', '003_publish_recipients_trigger', '004_selected_recipients', '005_notification_photos', '006_required_completion_proof', '007_notification_files'].map(name => `db/migrations/${name}.sql`)]) sqlite.exec(readFileSync(path, 'utf8'));
  sqlite.exec("INSERT INTO class_members VALUES ('a@example.com', '甲', 1)");
  const db = { prepare: (sql: string) => {
    const statement = sqlite.prepare(sql);
    const bound = (args: unknown[]) => { const values = args.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value) as never[]; return {
      first: async () => statement.get(...values) ?? null,
      all: async () => ({ results: statement.all(...values) }),
      run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } })
    }; };
    return { ...bound([]), bind: (...args: unknown[]) => bound(args) };
  }, batch: async (statements: { run: () => Promise<unknown> }[]) => {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  const context = (request: Request, authorized = true) => ({ request, env: { DB: db, ADMIN_EMAILS: 'admin@example.com' }, data: authorized ? { cloudflareAccess: { JWT: { payload: { email: 'admin@example.com' } } } } : {} }) as never;
  const json = (method: string, body: unknown) => context(new Request('https://example.com/api/admin/notifications', { method, body: JSON.stringify(body) }));
  const fileRequest = (bytes: Uint8Array<ArrayBuffer>, name = '报名表.pdf') => { const form = new FormData(); form.append('file', new Blob([bytes]), name); return new Request('https://example.com/api/admin/notification-files', { method: 'POST', body: form }); };
  return { sqlite, db, context, json, fileRequest };
}
const draft = { title: '附件通知', body: '前文后文', kind: 'notice', priority: 'normal', dueAt: null, pinned: false };

it('revalidates publication before reusing cached bytes and returns metadata without reading chunks', async () => {
  const { sqlite, db, context, json, fileRequest } = setup();
  const responses = new Map<string, Response>();
  const cache = { match: async (key: Request) => responses.get(key.url)?.clone(), put: async (key: Request, response: Response) => { responses.set(key.url, response.clone()); } };
  try {
    const file = await (await upload(context(fileRequest(new Uint8Array([1, 2, 3]))))).json() as { id: string };
    const { id } = await (await create(json('POST', { ...draft, attachments: [{ id: file.id, position: 0 }] }))).json() as { id: string };
    await transition(json('PATCH', { id, action: 'publish' }));
    const request = new Request(`https://example.com/api/notification-file?notificationId=${id}&id=${file.id}`);
    const pending: Promise<unknown>[] = [];
    const first = await downloadFile(db as unknown as D1Database, request, false, { cache, waitUntil: promise => { pending.push(promise); } });
    expect(first.status).toBe(200); await Promise.all(pending);
    const etag = first.headers.get('ETag'); expect(etag).toBeTruthy();
    const noChunks = { ...db, prepare: (sql: string) => { if (sql.includes('FROM notification_file_chunks')) throw Error('chunk source unavailable'); return db.prepare(sql); } };
    const cached = await downloadFile(noChunks as unknown as D1Database, request, false, { cache });
    expect(cached.status).toBe(200);
    expect(new Uint8Array(await cached.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    const conditional = new Request(request.url, { headers: { 'If-None-Match': etag! } });
    expect((await downloadFile(noChunks as unknown as D1Database, conditional)).status).toBe(304);
    expect((await downloadFile(noChunks as unknown as D1Database, new Request(request.url, { method: 'HEAD' }))).status).toBe(200);
    await transition(json('PATCH', { id, action: 'withdraw' }));
    expect((await downloadFile(noChunks as unknown as D1Database, conditional, false, { cache })).status).toBe(404);
  } finally { sqlite.close(); }
});

it('stores large binary files, keeps draft downloads private and exposes only saved published attachments', async () => {
  const { sqlite, db, context, json, fileRequest } = setup();
  const bytes = Uint8Array.from({ length: 2_100_007 }, (_, index) => index % 256);
  try {
    expect((await upload(context(fileRequest(bytes), false))).status).toBe(403);
    const uploaded = await upload(context(fileRequest(bytes)));
    expect(uploaded.status).toBe(200);
    const file = await uploaded.json() as { id: string; name: string; size: number };
    expect(file).toMatchObject({ name: '报名表.pdf', size: bytes.length });
    expect(sqlite.prepare('SELECT COUNT(*) AS chunks FROM notification_file_chunks').get()?.chunks).toBe(5);
    const response = await create(json('POST', { ...draft, attachments: [{ ...file, name: 'forged.html', size: 1, position: 2 }] }));
    expect(response.status).toBe(200);
    const { id } = await response.json() as { id: string };
    const publicContext = context(new Request(`https://example.com/api/notification-file?notificationId=${id}&id=${file.id}`), false);
    expect((await publicFile(publicContext)).status).toBe(404);
    const privateContext = context(new Request(`https://example.com/api/admin/notification-file?id=${file.id}`));
    expect((await adminFile({ ...(privateContext as object), data: {} } as never)).status).toBe(403);
    const preview = await adminFile(privateContext);
    expect(Buffer.compare(Buffer.from(await preview.arrayBuffer()), Buffer.from(bytes))).toBe(0);
    expect(await (await list(context(new Request('https://example.com/api/admin/notifications')))).json()).toMatchObject([{ attachments: [{ id: file.id, name: '报名表.pdf', size: bytes.length, position: 2 }] }]);
    await transition(json('PATCH', { id, action: 'publish' }));
    const snapshot = await loadSnapshot(db as unknown as D1Database);
    expect(snapshot.notifications).toMatchObject([{ attachments: [{ name: '报名表.pdf', position: 2, url: `/api/notification-file?notificationId=${id}&id=${file.id}` }] }]);
    expect(JSON.stringify(snapshot).length).toBeLessThan(4000);
    const download = await publicFile(publicContext);
    expect(download.status).toBe(200);
    expect(download.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(download.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(download.headers.get('Content-Disposition')).toContain(encodeURIComponent('报名表.pdf'));
    expect(download.headers.get('Cache-Control')).toBe('no-store');
    expect(Buffer.compare(Buffer.from(await download.arrayBuffer()), Buffer.from(bytes))).toBe(0);
    await transition(json('PATCH', { id, action: 'withdraw' }));
    expect((await publicFile(publicContext)).status).toBe(404);
  } finally { sqlite.close(); }
});

it('rejects missing or removed attachment references and oversize/empty uploads', async () => {
  const { sqlite, context, json, fileRequest } = setup();
  try {
    expect((await create(json('POST', { ...draft, attachments: [{ id: 'missing', position: 0 }] }))).status).toBe(400);
    expect((await upload(context(fileRequest(new Uint8Array())))).status).toBe(400);
    expect((await upload(context(fileRequest(new Uint8Array(10 * 1024 * 1024 + 1))))).status).toBe(413);
    const uploaded = await (await upload(context(fileRequest(new Uint8Array([1, 2, 3]))))).json() as { id: string };
    const { id } = await (await create(json('POST', { ...draft, attachments: [{ id: uploaded.id, position: 0 }] }))).json() as { id: string };
    await edit(json('PUT', { ...draft, id, attachments: [] })); await transition(json('PATCH', { id, action: 'publish' }));
    expect((await publicFile(context(new Request(`https://example.com/api/notification-file?notificationId=${id}&id=${uploaded.id}`), false))).status).toBe(404);
  } finally { sqlite.close(); }
});

it('cleans up abandoned old uploads but retains linked drafts and rolls back incomplete uploads', async () => {
  const { sqlite, context, json, fileRequest } = setup();
  try {
    const uploadSmall = async () => (await (await upload(context(fileRequest(new Uint8Array([1, 2, 3]))))).json()) as { id: string };
    const orphan = await uploadSmall(); const linked = await uploadSmall();
    await create(json('POST', { ...draft, attachments: [{ id: linked.id, position: 0 }] }));
    sqlite.exec("UPDATE notification_files SET created_at='2000-01-01T00:00:00.000Z'");
    await uploadSmall();
    expect(sqlite.prepare('SELECT id FROM notification_files WHERE id=?').get(orphan.id)).toBeUndefined();
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_file_chunks WHERE file_id=?').get(orphan.id)?.count).toBe(0);
    expect(sqlite.prepare('SELECT id FROM notification_files WHERE id=?').get(linked.id)?.id).toBe(linked.id);
    const before = Number(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_files').get()?.count);
    sqlite.exec("CREATE TRIGGER reject_chunk BEFORE INSERT ON notification_file_chunks WHEN NEW.sequence=1 BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END");
    expect((await upload(context(fileRequest(new Uint8Array(600_000))))).status).toBe(503);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notification_files').get()?.count).toBe(before);
  } finally { sqlite.close(); }
});

it('does not save broken references when cleanup wins after metadata resolution', async () => {
  const { sqlite, db, context, json, fileRequest } = setup();
  try {
    for (const method of ['POST', 'PUT']) {
      const existing = method === 'PUT' ? await (await create(json('POST', draft))).json() as { id: string } : undefined;
      const file = await (await upload(context(fileRequest(new Uint8Array([1, 2, 3]))))).json() as { id: string };
      const racedDb = { ...db, prepare: (sql: string) => {
        const statement = db.prepare(sql);
        if (!sql.startsWith('SELECT id, name, size FROM notification_files WHERE id IN')) return statement;
        return { ...statement, bind: (...args: unknown[]) => {
          const bound = statement.bind(...args);
          return { ...bound, all: async () => { const rows = await bound.all(); sqlite.prepare('DELETE FROM notification_files WHERE id=?').run(file.id); return rows; } };
        } };
      } };
      const request = json(method, { ...draft, id: existing?.id, attachments: [{ id: file.id, position: 0 }] });
      const racedContext = { ...(request as object), env: { DB: racedDb, ADMIN_EMAILS: 'admin@example.com' } } as never;
      expect((await (method === 'POST' ? create(racedContext) : edit(racedContext))).status).toBe(409);
      expect(sqlite.prepare("SELECT COUNT(*) AS count FROM notifications WHERE json_array_length(attachments)>0").get()?.count).toBe(0);
    }
  } finally { sqlite.close(); }
});
