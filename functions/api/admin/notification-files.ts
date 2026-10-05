import { MAX_FILE_SIZE } from '../../../src/domain/attachments';
import { denied, invalid, requireAdmin, unavailable, type AdminData, type AdminEnv } from './auth';

const CHUNK_SIZE = 512 * 1024;
export const onRequestPost: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  const tooLarge = () => Response.json({ error: '每个文件不能超过 10 MB' }, { status: 413 });
  const contentType = context.request.headers.get('Content-Type') ?? '';
  if (!contentType.startsWith('multipart/form-data;')) return invalid('请选择要上传的文件');
  const reader = context.request.body?.getReader();
  if (!reader) return invalid('请选择要上传的文件');
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_FILE_SIZE + 64 * 1024) { await reader.cancel(); return tooLarge(); }
      parts.push(value as Uint8Array<ArrayBuffer>);
    }
    const form = await new Response(new Blob(parts), { headers: { 'Content-Type': contentType } }).formData();
    const file = form.get('file');
    if (!file || typeof file === 'string' || !file.size) return invalid('不能上传空文件');
    if (file.size > MAX_FILE_SIZE) return tooLarge();
    const name = file.name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!name || name.length > 255) return invalid('文件名无效或过长');
    const bytes = await file.arrayBuffer();
    const id = crypto.randomUUID();
    const author = context.data.cloudflareAccess!.JWT!.payload!.email!.toLowerCase();
    // Remove abandoned uploads after seven days; referenced files are retained.
    await context.env.DB.prepare("DELETE FROM notification_files WHERE created_at<? AND NOT EXISTS (SELECT 1 FROM notifications n, json_each(n.attachments) a WHERE json_extract(a.value, '$.id')=notification_files.id)").bind(new Date(Date.now() - 7 * 86400000).toISOString()).run();
    const statements = [context.env.DB.prepare('INSERT INTO notification_files (id, name, size, author_email, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, name, file.size, author, new Date().toISOString())];
    for (let start = 0, sequence = 0; start < bytes.byteLength; start += CHUNK_SIZE, sequence++) statements.push(context.env.DB.prepare('INSERT INTO notification_file_chunks (file_id, sequence, data) VALUES (?, ?, ?)').bind(id, sequence, bytes.slice(start, start + CHUNK_SIZE)));
    await context.env.DB.batch(statements);
    return Response.json({ id, name, size: file.size, url: `/api/admin/notification-file?id=${encodeURIComponent(id)}` }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    if (cause instanceof TypeError) return invalid('文件读取失败，请重新选择');
    return unavailable();
  } finally { reader.releaseLock(); }
};
