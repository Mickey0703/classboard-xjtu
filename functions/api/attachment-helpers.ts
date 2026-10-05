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

export async function downloadFile(db: D1Database, request: Request, admin = false): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const id = query.get('id');
  const notificationId = query.get('notificationId');
  if (!id || (!admin && !notificationId)) return Response.json({ error: '缺少附件编号' }, { status: 400 });
  try {
    const file = admin ? await db.prepare('SELECT id, name, size FROM notification_files WHERE id=?').bind(id).first<{ id: string; name: string; size: number }>() :
      await db.prepare("SELECT f.id, f.name, f.size FROM notification_files f JOIN notifications n ON n.id=? WHERE f.id=? AND n.status='published' AND EXISTS (SELECT 1 FROM json_each(n.attachments) a WHERE json_extract(a.value, '$.id')=f.id)").bind(notificationId, id).first<{ id: string; name: string; size: number }>();
    if (!file) return Response.json({ error: '附件不存在或通知已撤回' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const bytes = new Uint8Array(file.size);
    let offset = 0;
    // Read one bounded BLOB at a time, avoiding a large D1 JSON result in memory.
    for (let sequence = 0; offset < file.size; sequence++) {
      const chunk = await db.prepare('SELECT data FROM notification_file_chunks WHERE file_id=? AND sequence=?').bind(id, sequence).first<{ data: number[] | ArrayBuffer }>();
      if (!chunk) throw Error('incomplete file');
      const data = new Uint8Array(chunk.data);
      if (data.length !== Math.min(512 * 1024, file.size - offset)) throw Error('invalid chunk');
      bytes.set(data, offset); offset += data.length;
    }
    const name = encodeURIComponent(file.name).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    const fallbackName = file.name.replace(/[^\x20-\x7e]|["\\]/g, '_');
    return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(file.size), 'Content-Disposition': `attachment; filename="${fallbackName}"; filename*=UTF-8''${name}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return Response.json({ error: '附件暂时无法下载，请稍后重试' }, { status: 503 }); }
}
