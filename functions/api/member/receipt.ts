import { nowShanghai } from '../admin/notification-helpers';
import { denied, invalid, requireMember, unavailable, type MemberData, type MemberEnv } from './auth';

interface RecipientRow { id: string; kind: 'notice' | 'task'; status: 'draft' | 'published' | 'withdrawn'; member_email: string }

export const onRequestGet: PagesFunction<MemberEnv, string, MemberData> = async context => {
  if (!requireMember(context)) return denied();
  try {
    const rows = await context.env.DB.prepare('SELECT notification_id, acknowledged_at, completed_at FROM notification_recipients WHERE member_email=?').bind(context.data.member!.email).all<{ notification_id: string; acknowledged_at: string | null; completed_at: string | null }>();
    return Response.json((rows.results ?? []).map(row => ({ notificationId: row.notification_id, acknowledgedAt: row.acknowledged_at, completedAt: row.completed_at })), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return unavailable(); }
};

export const onRequestPost: PagesFunction<MemberEnv, string, MemberData> = async context => {
  if (!requireMember(context)) return denied();
  let body: { notificationId?: unknown; action?: unknown };
  try { body = await context.request.json() as typeof body; } catch { return invalid(); }
  if (typeof body.notificationId !== 'string' || !['ack', 'complete', 'undoComplete'].includes(String(body.action))) return invalid();
  const email = context.data.member!.email;
  try {
    const row = await context.env.DB.prepare('SELECT n.id, n.kind, n.status, r.member_email FROM notifications n JOIN notification_recipients r ON r.notification_id=n.id WHERE n.id=? AND r.member_email=?').bind(body.notificationId, email).first<RecipientRow>();
    if (!row) return Response.json({ error: '这条通知不在你的收件名单中' }, { status: 404 });
    if (row.status !== 'published') return Response.json({ error: '这条通知已撤回' }, { status: 409 });
    if (body.action !== 'ack' && row.kind !== 'task') return invalid('普通公告没有完成状态');
    const at = nowShanghai();
    if (body.action === 'ack') await context.env.DB.prepare('UPDATE notification_recipients SET acknowledged_at=COALESCE(acknowledged_at, ?) WHERE notification_id=? AND member_email=?').bind(at, row.id, email).run();
    if (body.action === 'complete') await context.env.DB.prepare('UPDATE notification_recipients SET acknowledged_at=COALESCE(acknowledged_at, ?), completed_at=COALESCE(completed_at, ?) WHERE notification_id=? AND member_email=?').bind(at, at, row.id, email).run();
    if (body.action === 'undoComplete') await context.env.DB.prepare('UPDATE notification_recipients SET completed_at=NULL WHERE notification_id=? AND member_email=?').bind(row.id, email).run();
    return Response.json({ notificationId: row.id, action: body.action });
  } catch { return unavailable(); }
};
