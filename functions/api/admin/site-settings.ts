import { denied, invalid, requireAdmin, unavailable, type AdminData, type AdminEnv } from './auth';

export const onRequestPut: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let body: { className?: unknown };
  try { body = await context.request.json() as typeof body; } catch { return invalid(); }
  if (typeof body.className !== 'string' || !body.className.trim() || body.className.length > 60) return invalid('班级名称须为 1–60 字');
  const className = body.className.trim();
  try {
    await context.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('className', className).run();
    return Response.json({ className });
  } catch { return unavailable(); }
};
