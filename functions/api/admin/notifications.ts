import { denied, invalid, requireAdmin, unavailable, type AdminData, type AdminEnv } from './auth';
import { normalizeEmail, nowShanghai, validNotification } from './notification-helpers';
import { attachmentLinks, resolveAttachments } from '../attachment-helpers';

type Ctx = Parameters<PagesFunction<AdminEnv, string, AdminData>>[0];
interface Row { id: string; status: 'draft' | 'published' | 'withdrawn'; recipient_emails?: string | null; photos?: string; requires_completion_proof?: number; attachments?: string }
const author = (context: Ctx) => context.data.cloudflareAccess?.JWT?.payload?.email?.toLowerCase() ?? '';
const selectedEmails = (emails: string[] | undefined) => emails === undefined ? null : [...new Set(emails.map(email => normalizeEmail(email)!))];
async function activeSelection(context: Ctx, emails: string[] | null) {
  if (emails === null) return true;
  const members = await context.env.DB.prepare('SELECT email FROM class_members WHERE active=1').all<{ email: string }>();
  const active = new Set((members.results ?? []).map(member => member.email.toLowerCase()));
  return emails.every(email => active.has(email));
}

export const onRequestGet: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  try {
    const result = await context.env.DB.prepare('SELECT * FROM notifications ORDER BY created_at DESC').all<Row>();
    return Response.json((result.results ?? []).map(({ recipient_emails, photos, attachments, requires_completion_proof, ...row }) => ({ ...row, attachments: attachmentLinks(attachments, row.id, true), requiresCompletionProof: Boolean(requires_completion_proof), photos: JSON.parse(photos ?? '[]'), recipientEmails: recipient_emails == null ? null : JSON.parse(recipient_emails) })), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return unavailable(); }
};

export const onRequestPost: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: unknown;
  try { body = await context.request.json(); } catch { return invalid(); }
  if (!validNotification(body)) return invalid('通知内容或截止时间无效');
  const id = crypto.randomUUID();
  try {
    const emails = selectedEmails(body.recipientEmails);
    if (!await activeSelection(context, emails)) return invalid('所选人员不在活跃名单中，请刷新名单后重新选择');
    const attachments = await resolveAttachments(context.env.DB, body.attachments);
    if (!attachments) return invalid('附件不存在或已过期，请重新上传');
    const result = await context.env.DB.prepare("INSERT INTO notifications (id, kind, priority, title, body, due_at, pinned, status, author_email, created_at, recipient_emails, photos, requires_completion_proof, attachments) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM json_each(?) a WHERE NOT EXISTS (SELECT 1 FROM notification_files f WHERE f.id=json_extract(a.value, '$.id')))")
      .bind(id, body.kind, body.priority, body.title.trim(), body.body, body.dueAt, body.pinned ? 1 : 0, 'draft', author(context), nowShanghai(), emails === null ? null : JSON.stringify(emails), JSON.stringify(body.photos ?? []), body.requiresCompletionProof ? 1 : 0, JSON.stringify(attachments), JSON.stringify(attachments)).run();
    if (result.meta?.changes === 0) return Response.json({ error: '附件已过期，请重新上传后保存' }, { status: 409 });
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
    const emails = selectedEmails(body.recipientEmails);
    if (!await activeSelection(context, emails)) return invalid('所选人员不在活跃名单中，请刷新名单后重新选择');
    const attachments = await resolveAttachments(context.env.DB, body.attachments);
    if (!attachments) return invalid('附件不存在或已过期，请重新上传');
    const result = await context.env.DB.prepare("UPDATE notifications SET kind=?, priority=?, title=?, body=?, due_at=?, pinned=?, recipient_emails=?, photos=?, requires_completion_proof=?, attachments=? WHERE id=? AND status=? AND NOT EXISTS (SELECT 1 FROM json_each(?) a WHERE NOT EXISTS (SELECT 1 FROM notification_files f WHERE f.id=json_extract(a.value, '$.id')))")
      .bind(body.kind, body.priority, body.title.trim(), body.body, body.dueAt, body.pinned ? 1 : 0, emails === null ? null : JSON.stringify(emails), JSON.stringify(body.photos ?? []), body.requiresCompletionProof ? 1 : 0, JSON.stringify(attachments), body.id, 'draft', JSON.stringify(attachments)).run();
    if (result.meta?.changes === 0) return Response.json({ error: '草稿状态或附件已变化，请刷新后重新保存' }, { status: 409 });
    return Response.json({ id: body.id, status: 'draft' });
  } catch { return unavailable(); }
};

export const onRequestPatch: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: { id?: unknown; action?: unknown };
  try { body = await context.request.json() as typeof body; } catch { return invalid(); }
  if (typeof body.id !== 'string' || !['publish', 'withdraw'].includes(String(body.action))) return invalid();
  try {
    const current = await context.env.DB.prepare('SELECT id, status, recipient_emails FROM notifications WHERE id=?').bind(body.id).first<Row>();
    if (!current) return Response.json({ error: '通知不存在' }, { status: 404 });
    if (body.action === 'withdraw') {
      if (current.status !== 'published') return Response.json({ error: '只能撤回已发布通知' }, { status: 409 });
      await context.env.DB.prepare('UPDATE notifications SET status=?, withdrawn_at=? WHERE id=? AND status=?').bind('withdrawn', nowShanghai(), body.id, 'published').run();
      return Response.json({ id: body.id, status: 'withdrawn' });
    }
    if (current.status !== 'draft') return Response.json({ error: '只能发布草稿' }, { status: 409 });
    const emails: string[] | null = current.recipient_emails == null ? null : JSON.parse(current.recipient_emails);
    if (emails && !emails.length) return invalid('请编辑草稿，至少选择一位收件人');
    if (!await activeSelection(context, emails)) return invalid('所选成员已停用，请编辑草稿重新选择收件人');
    const members = await context.env.DB.prepare('SELECT email FROM class_members WHERE active=1').all<{ email: string }>();
    if (!members.results?.length) return invalid('请先添加班级成员，再发布通知');
    // The trigger inserts the roster snapshot within this guarded UPDATE's transaction.
    const result = await context.env.DB.prepare(`UPDATE notifications SET status='published', published_at=? WHERE id=? AND status='draft' AND EXISTS (SELECT 1 FROM class_members WHERE active=1)
      AND (recipient_emails IS NULL OR (json_array_length(recipient_emails)>0 AND NOT EXISTS (
        SELECT 1 FROM json_each(recipient_emails) selected WHERE NOT EXISTS (SELECT 1 FROM class_members WHERE email=selected.value COLLATE NOCASE AND active=1)
      )))`)
      .bind(nowShanghai(), body.id).run();
    if (result.meta?.changes === 0) return Response.json({ error: '通知状态或成员名单已变化，请刷新后重试' }, { status: 409 });
    return Response.json({ id: body.id, status: 'published' });
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
