import { nowShanghai } from '../admin/notification-helpers';
import { denied, invalid, requireMember, unavailable, type MemberData, type MemberEnv } from './auth';
import { validPhotos } from '../../../src/domain/photos';
import { completionPhotoLinks, completionPhotoRefs } from '../completion-photo-helpers';

interface RecipientRow { id: string; kind: 'notice' | 'task'; status: 'draft' | 'published' | 'withdrawn'; member_email: string; requires_completion_proof: number; completed_at: string | null }

export const onRequestGet: PagesFunction<MemberEnv, string, MemberData> = async context => {
  if (!requireMember(context)) return denied();
  try {
    const rows = await context.env.DB.prepare(`SELECT notification_id, acknowledged_at, completed_at, ${completionPhotoRefs('completion_photos')} AS completion_photos FROM notification_recipients WHERE member_email=?`).bind(context.data.member!.email).all<{ notification_id: string; acknowledged_at: string | null; completed_at: string | null; completion_photos?: string }>();
    return Response.json((rows.results ?? []).map(row => ({ notificationId: row.notification_id, acknowledgedAt: row.acknowledged_at, completedAt: row.completed_at, photos: completionPhotoLinks(row.completion_photos, row.notification_id) })), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return unavailable(); }
};

export const onRequestPost: PagesFunction<MemberEnv, string, MemberData> = async context => {
  if (!requireMember(context)) return denied();
  let body: { notificationId?: unknown; action?: unknown; photos?: unknown };
  try { body = await context.request.json() as typeof body; } catch { return invalid(); }
  if (typeof body.notificationId !== 'string' || !['ack', 'complete', 'undoComplete'].includes(String(body.action))) return invalid();
  if (body.photos !== undefined && (body.action !== 'complete' || !validPhotos(body.photos))) return invalid('照片格式或大小无效，每次最多提交 3 张照片');
  const email = context.data.member!.email;
  try {
    const row = await context.env.DB.prepare('SELECT n.id, n.kind, n.status, n.requires_completion_proof, r.member_email, r.completed_at FROM notifications n JOIN notification_recipients r ON r.notification_id=n.id WHERE n.id=? AND r.member_email=?').bind(body.notificationId, email).first<RecipientRow>();
    if (!row) return Response.json({ error: '这条通知不在你的收件名单中' }, { status: 404 });
    if (row.status !== 'published') return Response.json({ error: '这条通知已撤回' }, { status: 409 });
    if (body.action !== 'ack' && row.kind !== 'task') return invalid('普通公告没有完成状态');
    if (body.action === 'complete' && row.requires_completion_proof && !row.completed_at && (!Array.isArray(body.photos) || body.photos.length === 0)) return invalid('请添加完成照片或截图后确认完成');
    const at = nowShanghai();
    let result: D1Result;
    if (body.action === 'ack') result = await context.env.DB.prepare("UPDATE notification_recipients SET acknowledged_at=COALESCE(acknowledged_at, ?) WHERE notification_id=? AND member_email=? AND EXISTS (SELECT 1 FROM notifications WHERE id=? AND status='published')").bind(at, row.id, email, row.id).run();
    else if (body.action === 'complete') result = await context.env.DB.prepare("UPDATE notification_recipients SET acknowledged_at=COALESCE(acknowledged_at, ?), completion_photos=CASE WHEN completed_at IS NULL THEN ? ELSE completion_photos END, completed_at=COALESCE(completed_at, ?) WHERE notification_id=? AND member_email=? AND EXISTS (SELECT 1 FROM notifications WHERE id=? AND status='published' AND (requires_completion_proof=0 OR ?=1 OR (notification_recipients.completed_at IS NOT NULL AND json_array_length(notification_recipients.completion_photos)>0)))").bind(at, JSON.stringify(body.photos ?? []), at, row.id, email, row.id, Array.isArray(body.photos) && body.photos.length > 0 ? 1 : 0).run();
    else result = await context.env.DB.prepare("UPDATE notification_recipients SET completed_at=NULL, completion_photos='[]' WHERE notification_id=? AND member_email=? AND EXISTS (SELECT 1 FROM notifications WHERE id=? AND status='published')").bind(row.id, email, row.id).run();
    if (result.meta?.changes === 0) return Response.json({ error: '通知或完成状态已变化，请刷新页面后重试' }, { status: 409 });
    return Response.json({ notificationId: row.id, action: body.action });
  } catch { return unavailable(); }
};
