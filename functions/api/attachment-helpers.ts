import type { Attachment, AttachmentRef } from '../../src/domain/attachments';

export function attachmentLinks(json: string | undefined, notificationId: string, admin = false): Attachment[] {
  return (JSON.parse(json ?? '[]') as Attachment[]).map(file => ({ ...file, url: admin ? `/api/admin/notification-file?id=${encodeURIComponent(file.id)}` : `/api/notification-file?notificationId=${encodeURIComponent(notificationId)}&id=${encodeURIComponent(file.id)}` }));
}

export async function resolveAttachments(db: D1Database, refs: AttachmentRef[] = []): Promise<Omit<Attachment, 'url'>[] | null> {
  if (!refs.length) return [];
  const rows = await db.prepare(`SELECT id, name, size FROM notification_files WHERE id IN (${refs.map(() => '?').join(',')})`).bind(...refs.map(file => file.id)).all<{ id: string; name: string; size: number }>();
  const files = refs.map(ref => { const row = rows.results?.find(file => file.id === ref.id); return row ? { ...row, position: ref.position } : null; });
  return files.every(file => file !== null) ? files as Omit<Attachment, 'url'>[] : null;
}

interface FileCache { match: (key: Request) => Promise<Response | undefined>; put: (key: Request, response: Response) => Promise<unknown> }
interface DownloadOptions { cache?: FileCache; waitUntil?: (promise: Promise<unknown>) => void }
export async function downloadFile(db: D1Database, request: Request, admin = false, options: DownloadOptions = {}): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const id = query.get('id');
  const notificationId = query.get('notificationId');
  if (!id || (!admin && !notificationId)) return Response.json({ error: '缺少附件编号' }, { status: 400 });
  try {
    const started = performance.now();
    const file = admin ? await db.prepare('SELECT id, name, size FROM notification_files WHERE id=?').bind(id).first<{ id: string; name: string; size: number }>() :
      await db.prepare("SELECT f.id, f.name, f.size FROM notification_files f JOIN notifications n ON n.id=? WHERE f.id=? AND n.status='published' AND EXISTS (SELECT 1 FROM json_each(n.attachments) a WHERE json_extract(a.value, '$.id')=f.id)").bind(notificationId, id).first<{ id: string; name: string; size: number }>();
    if (!file) return Response.json({ error: '附件不存在或通知已撤回' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const metadataMs = performance.now() - started;
    const etag = `"${file.id}-${file.size}"`;
    const name = encodeURIComponent(file.name).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    const fallbackName = file.name.replace(/[^\x20-\x7e]|["\\]/g, '_');
    const headers = new Headers({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(file.size), 'Content-Disposition': `attachment; filename="${fallbackName}"; filename*=UTF-8''${name}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ETag: etag, 'Server-Timing': `file-meta;dur=${metadataMs.toFixed(1)}` });
    // Always check the live publication/permission first, even for cached bytes.
    if (request.headers.get('If-None-Match')?.split(',').map(value => value.trim()).some(value => value === etag || value === '*')) {
      headers.delete('Content-Length'); return new Response(null, { status: 304, headers });
    }
    if (request.method === 'HEAD') return new Response(null, { headers });
    let cache = options.cache;
    // A named namespace keeps raw bytes out of the automatic public/default cache.
    if (!cache) {
      try { cache = await (globalThis as unknown as { caches?: { open: (name: string) => Promise<FileCache> } }).caches?.open('notification-file-bytes-v1'); }
      catch { /* Workers fronted by Access may not offer the Cache API. */ }
    }
    const cacheKey = new Request(new URL(`/__notification-file-bytes/${encodeURIComponent(file.id)}`, request.url));
    let cached: Response | undefined;
    try { cached = await cache?.match(cacheKey); } catch { /* Cache availability must not block downloads. */ }
    if (cached && cached.headers.get('Content-Length') === String(file.size)) {
      headers.append('Server-Timing', `file-bytes;dur=${(performance.now() - started - metadataMs).toFixed(1)};desc="edge-cache"`);
      return new Response(cached.body, { headers });
    }
    const bytes = new Uint8Array(file.size);
    let offset = 0;
    // Two bounded chunks in parallel avoid serial round trips without large JSON results.
    const count = Math.ceil(file.size / (512 * 1024));
    for (let sequence = 0; sequence < count; sequence += 2) {
      const group = await Promise.all(Array.from({ length: Math.min(2, count - sequence) }, (_, index) => db.prepare('SELECT data FROM notification_file_chunks WHERE file_id=? AND sequence=?').bind(id, sequence + index).first<{ data: number[] | ArrayBuffer }>()));
      for (const chunk of group) {
        if (!chunk) throw Error('incomplete file');
        const data = new Uint8Array(chunk.data);
        if (data.length !== Math.min(512 * 1024, file.size - offset)) throw Error('invalid chunk');
        bytes.set(data, offset); offset += data.length;
      }
    }
    if (cache) {
      const store = Promise.resolve().then(() => cache.put(cacheKey, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(file.size), 'Cache-Control': 'public, max-age=86400' } }))).catch(() => {});
      if (options.waitUntil) options.waitUntil(store); else await store;
    }
    headers.append('Server-Timing', `file-bytes;dur=${(performance.now() - started - metadataMs).toFixed(1)};desc="database"`);
    return new Response(bytes, { headers });
  } catch { return Response.json({ error: '附件暂时无法下载，请稍后重试' }, { status: 503 }); }
}
