export interface AdminEnv { DB: D1Database; ADMIN_EMAILS: string; ACCESS_DOMAIN: string; ACCESS_AUD: string }
export interface AdminData { cloudflareAccess?: { JWT?: { payload?: { email?: string } } } }

export function isAdminEmail(email: string | undefined, allowlist: string | undefined): boolean {
  if (!email || !allowlist) return false;
  return allowlist.split(',').some(item => item.trim().toLowerCase() === email.toLowerCase());
}

export function requireAdmin(context: { data?: AdminData; env: { ADMIN_EMAILS?: string }; request?: Request }): boolean {
  const email = context.data?.cloudflareAccess?.JWT?.payload?.email;
  if (!isAdminEmail(email, context.env.ADMIN_EMAILS)) return false;
  if (context.request) {
    const origin = context.request.headers.get('Origin');
    if (origin && origin !== new URL(context.request.url).origin) return false;
  }
  return true;
}

export const denied = () => Response.json({ error: '没有班委编辑权限' }, { status: 403 });
export const invalid = (message = '提交内容不完整或格式有误') => Response.json({ error: message }, { status: 400 });
export const unavailable = () => Response.json({ error: '保存失败，请稍后重试' }, { status: 503 });
