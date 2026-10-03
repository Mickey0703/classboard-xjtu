import { denied, invalid, requireAdmin, type AdminData, type AdminEnv } from './auth';
import { normalizeEmail } from './notification-helpers';
import { serveCompletionPhoto } from '../completion-photo-helpers';

export const onRequestGet: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  const email = normalizeEmail(new URL(context.request.url).searchParams.get('email'));
  if (!email) return invalid('缺少提交者邮箱');
  return serveCompletionPhoto(context.env.DB, context.request, email);
};
