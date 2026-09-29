import { denied, invalid, requireAdmin, unavailable, type AdminData, type AdminEnv } from './auth';
import { nowShanghai, validNotification, type NotificationInput } from './notification-helpers';

type Ctx = Parameters<PagesFunction<AdminEnv, string, AdminData>>[0];
interface Row { id: string; status: 'draft' | 'published' | 'withdrawn' }
const author = (context: Ctx) => context.data.cloudflareAccess?.JWT?.payload?.email?.toLowerCase() ?? '';

export const onRequestGet: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  try {
    const result = await context.env.DB.prepare('SELECT * FROM notifications ORDER BY created_at DESC').all();
    return Response.json(result.results ?? []);
  } catch { return unavailable(); }
};

export const onRequestPost: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: unknown;
  try { body = await context.request.json(); } catch { return invalid(); }
  if (!validNotification(body)) return invalid('通知内容或截止时间无效');
  const id = crypto.randomUUID();
  try {
    await context.env.DB.prepare('INSERT INTO notifications (id, kind, priority, title, body, due_at, pinned, status, author_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, body.kind, body.priority, body.title.trim(), body.body.trim(), body.dueAt, body.pinned ? 1 : 0, 'draft', author(context), nowShanghai()).run();
    return Response.json({ id, status: 'draft' });
  } catch { return unavailable(); }
};

export const onRequestPut: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: unknown;
  try { body = await context.request.json(); } catch { return invalid(); }
  if (!validNotification(body) || typeof body.id !== 'string' || !body.id) return invalid();
  try {
    const current = await context.env.DB.prepare('SELECT id, status FROM notifications WHERE id=?').bind(body.id).first<Row>();
    if (!current) return Response.json({ error: '通知不存在' }, { status: 404 });
    if (current.status !== 'draft') return Response.json({ error: '已发布通知不能直接修改，请撤回后重发' }, { status: 409 });
    await context.env.DB.prepare('UPDATE notifications SET kind=?, priority=?, title=?, body=?, due_at=?, pinned=? WHERE id=? AND status=?')
      .bind(body.kind, body.priority, body.title.trim(), body.body.trim(), body.dueAt, body.pinned ? 1 : 0, body.id, 'draft').run();
    return Response.json({ id: body.id, status: 'draft' });
  } catch { return unavailable(); }
};

export const onRequestPatch: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: { id?: unknown; action?: unknown };
  try { body = await context.request.json() as typeof body; } catch { return invalid(); }
  if (typeof body.id !== 'string' || !['publish', 'withdraw'].includes(String(body.action))) return invalid();
  try {
    const current = await context.env.DB.prepare('SELECT id, status FROM notifications WHERE id=?').bind(body.id).first<Row>();
    if (!current) return Response.json({ error: '通知不存在' }, { status: 404 });
    if (body.action === 'withdraw') {
      if (current.status !== 'published') return Response.json({ error: '只能撤回已发布通知' }, { status: 409 });
      await context.env.DB.prepare('UPDATE notifications SET status=?, withdrawn_at=? WHERE id=? AND status=?').bind('withdrawn', nowShanghai(), body.id, 'published').run();
      return Response.json({ id: body.id, status: 'withdrawn' });
    }
    if (current.status !== 'draft') return Response.json({ error: '只能发布草稿' }, { status: 409 });
    const members = await context.env.DB.prepare('SELECT email FROM class_members WHERE active=1').all<{ email: string }>();
    if (!members.results?.length) return invalid('请先添加班级成员，再发布通知');
    const statements = [context.env.DB.prepare('UPDATE notifications SET status=?, published_at=? WHERE id=? AND status=?').bind('published', nowShanghai(), body.id, 'draft'),
      ...members.results.map(member => context.env.DB.prepare('INSERT INTO notification_recipients (notification_id, member_email) VALUES (?, ?)').bind(body.id, member.email))];
    await context.env.DB.batch(statements);
    return Response.json({ id: body.id, status: 'published', recipients: members.results.length });
  } catch { return unavailable(); }
};

export const onRequestDelete: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: { id?: unknown };
  try { body = await context.request.json() as typeof body; } catch { return invalid(); }
  if (typeof body.id !== 'string') return invalid();
  try {
    const result = await context.env.DB.prepare('DELETE FROM notifications WHERE id=? AND status=?').bind(body.id, 'draft').run();
    if (result.meta?.changes === 0) return Response.json({ error: '只能删除草稿' }, { status: 409 });
    return Response.json({ id: body.id });
  } catch { return unavailable(); }
};
