import { denied, invalid, requireAdmin, unavailable, type AdminData, type AdminEnv } from './auth';
import { normalizeEmail } from './notification-helpers';
import { validateRoster } from '../../../src/domain/roster';

type Ctx = Parameters<PagesFunction<AdminEnv, string, AdminData>>[0];
const validName = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 80;

export const onRequestGet: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  try {
    const result = await context.env.DB.prepare('SELECT email, display_name, active FROM class_members ORDER BY display_name, email').all<{ email: string; display_name: string; active: number }>();
    return Response.json((result.results ?? []).map(row => ({ email: row.email, displayName: row.display_name, active: Boolean(row.active) })));
  } catch { return unavailable(); }
};

export const onRequestPost: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: { email?: unknown; displayName?: unknown; members?: unknown };
  try { body = await context.request.json() as typeof body; } catch { return invalid(); }
  if (!body || typeof body !== 'object') return invalid();
  if (body.members !== undefined) {
    let members;
    try { members = validateRoster(body.members); }
    catch (cause) { return invalid(cause instanceof Error ? cause.message : '名单无效'); }
    try {
      await context.env.DB.batch(members.map(member => context.env.DB.prepare('INSERT INTO class_members (email, display_name, active) VALUES (?, ?, 1) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name, active=1').bind(member.email, member.displayName)));
      return Response.json({ imported: members.length });
    } catch { return unavailable(); }
  }
  const email = normalizeEmail(body.email);
  if (!email || !validName(body.displayName)) return invalid('请填写有效的姓名与邮箱');
  try {
    await context.env.DB.prepare('INSERT INTO class_members (email, display_name, active) VALUES (?, ?, 1) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name, active=1').bind(email, body.displayName.trim()).run();
    return Response.json({ email, displayName: body.displayName.trim(), active: true });
  } catch { return unavailable(); }
};

export const onRequestPut: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: { email?: unknown; displayName?: unknown; active?: unknown };
  try { body = await context.request.json() as typeof body; } catch { return invalid(); }
  const email = normalizeEmail(body.email);
  if (!email || !validName(body.displayName) || typeof body.active !== 'boolean') return invalid();
  try {
    const result = await context.env.DB.prepare('UPDATE class_members SET display_name=?, active=? WHERE email=?').bind(body.displayName.trim(), body.active ? 1 : 0, email).run();
    if (result.meta?.changes === 0) return Response.json({ error: '成员不存在' }, { status: 404 });
    return Response.json({ email, displayName: body.displayName.trim(), active: body.active });
  } catch { return unavailable(); }
};

export const onRequestDelete: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: { email?: unknown };
  try { body = await context.request.json() as typeof body; } catch { return invalid(); }
  const email = normalizeEmail(body.email);
  if (!email) return invalid();
  try { await context.env.DB.prepare('UPDATE class_members SET active=0 WHERE email=?').bind(email).run(); return Response.json({ email, active: false }); }
  catch { return unavailable(); }
};
