import cloudflareAccessPlugin from '@cloudflare/pages-plugin-cloudflare-access';
import { normalizeEmail } from '../admin/notification-helpers';
import { denied, type MemberData, type MemberEnv } from './auth';

export const onRequest: PagesFunction<MemberEnv, string, MemberData>[] = [
  context => {
    const host = new URL(context.request.url).hostname;
    if (context.env.LOCAL_DEV_MODE === 'true' && ['localhost', '127.0.0.1'].includes(host)) {
      const cookie = context.request.headers.get('Cookie') ?? '';
      if (!context.env.LOCAL_DEV_MEMBER_TOKEN || !cookie.split(';').some(part => part.trim() === `local_member=${context.env.LOCAL_DEV_MEMBER_TOKEN}`) || !context.env.LOCAL_DEV_MEMBER_EMAIL) return denied();
      context.data.cloudflareAccess = { JWT: { payload: { email: context.env.LOCAL_DEV_MEMBER_EMAIL } } };
      return context.next();
    }
    if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(context.env.ACCESS_DOMAIN ?? '') || !context.env.MEMBER_ACCESS_AUD) return denied();
    return cloudflareAccessPlugin({ domain: context.env.ACCESS_DOMAIN as `https://${string}.cloudflareaccess.com`, aud: context.env.MEMBER_ACCESS_AUD })(context);
  },
  async context => {
    const email = normalizeEmail(context.data.cloudflareAccess?.JWT?.payload?.email);
    if (!email) return denied();
    try {
      const member = await context.env.DB.prepare('SELECT email, display_name, active FROM class_members WHERE email=? AND active=1').bind(email).first<{ email: string; display_name: string; active: number }>();
      if (!member) return denied();
      context.data.member = { email: member.email, displayName: member.display_name };
      return context.next();
    } catch { return Response.json({ error: '成员身份暂时无法确认' }, { status: 503 }); }
  }
];
