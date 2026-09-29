import { denied, invalid, requireAdmin, unavailable, type AdminData, type AdminEnv } from './auth';

export const onRequestGet: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  const id = new URL(context.request.url).searchParams.get('id');
  if (!id) return invalid('缺少通知编号');
  try {
    const rows = await context.env.DB.prepare('SELECT r.member_email, m.display_name, r.acknowledged_at, r.completed_at FROM notification_recipients r LEFT JOIN class_members m ON m.email=r.member_email WHERE r.notification_id=? ORDER BY m.display_name, r.member_email')
      .bind(id).all<{ member_email: string; display_name: string | null; acknowledged_at: string | null; completed_at: string | null }>();
    const recipients = (rows.results ?? []).map(row => ({ email: row.member_email, displayName: row.display_name ?? row.member_email, acknowledgedAt: row.acknowledged_at, completedAt: row.completed_at }));
    return Response.json({ total: recipients.length, acknowledged: recipients.filter(r => r.acknowledgedAt).length, completed: recipients.filter(r => r.completedAt).length,
      notAcknowledged: recipients.filter(r => !r.acknowledgedAt), notCompleted: recipients.filter(r => !r.completedAt) });
  } catch { return unavailable(); }
};
