import type { AdminEnv } from '../admin/auth';

export interface MemberEnv extends AdminEnv { MEMBER_ACCESS_AUD: string; LOCAL_DEV_MEMBER_EMAIL?: string; LOCAL_DEV_MEMBER_TOKEN?: string }
export interface MemberData extends Record<string, unknown> {
  cloudflareAccess?: { JWT?: { payload?: { email?: string } } };
  member?: { email: string; displayName: string };
}
export const denied = () => Response.json({ error: '请使用班级名单中的邮箱登录' }, { status: 403 });
export const invalid = (message = '提交内容无效') => Response.json({ error: message }, { status: 400 });
export const unavailable = () => Response.json({ error: '暂时无法保存确认状态' }, { status: 503 });

export function requireMember(context: { data?: MemberData; request?: Request }): boolean {
  if (!context.data?.member?.email) return false;
  if (context.request) {
    const origin = context.request.headers.get('Origin');
    if (origin && origin !== new URL(context.request.url).origin) return false;
  }
  return true;
}
