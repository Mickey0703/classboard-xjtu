import type { Photo } from '../../src/domain/photos';

// Project only identifiers in SQLite, rather than materializing every image in a list response.
export const completionPhotoRefs = (column: string) => `(SELECT json_group_array(json_object('id', json_extract(photo.value, '$.id'))) FROM json_each(${column}) photo)`;

export function completionPhotoLinks(json: string | undefined, notificationId: string, email?: string): Photo[] {
  const prefix = email === undefined ? '/api/member/completion-photo' : '/api/admin/completion-photo';
  return (JSON.parse(json ?? '[]') as { id: string }[]).map(photo => ({ id: photo.id, dataUrl: `${prefix}?notificationId=${encodeURIComponent(notificationId)}${email === undefined ? '' : `&email=${encodeURIComponent(email)}`}&photoId=${encodeURIComponent(photo.id)}` }));
}

export async function serveCompletionPhoto(db: D1Database, request: Request, email: string): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const notificationId = params.get('notificationId');
  const photoId = params.get('photoId');
  if (!notificationId || !photoId) return Response.json({ error: '缺少照片编号' }, { status: 400 });
  try {
    const row = await db.prepare("SELECT json_extract(photo.value, '$.dataUrl') AS data_url FROM notification_recipients r, json_each(r.completion_photos) photo WHERE r.notification_id=? AND r.member_email=? AND r.completed_at IS NOT NULL AND json_extract(photo.value, '$.id')=? LIMIT 1").bind(notificationId, email, photoId).first<{ data_url: string }>();
    if (!row) return Response.json({ error: '照片不存在或已清除' }, { status: 404 });
    const match = /^data:image\/(png|jpeg|webp);base64,(.*)$/.exec(row.data_url);
    if (!match) throw Error('invalid photo');
    const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
    return new Response(bytes, { headers: { 'Content-Type': `image/${match[1]}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return Response.json({ error: '照片暂不可用' }, { status: 503 }); }
}
