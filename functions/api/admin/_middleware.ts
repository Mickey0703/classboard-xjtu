import cloudflareAccessPlugin from '@cloudflare/pages-plugin-cloudflare-access';
import { denied, requireAdmin, type AdminData, type AdminEnv } from './auth';

export const onRequest: PagesFunction<AdminEnv, string, AdminData>[] = [
  (context) => {
    const host = new URL(context.request.url).hostname;
    if (context.env.LOCAL_DEV_MODE === 'true' && ['localhost', '127.0.0.1'].includes(host)) {
      const cookie = context.request.headers.get('Cookie') ?? '';
      if (!context.env.LOCAL_DEV_TOKEN || !cookie.split(';').some(part => part.trim() === `local_admin=${context.env.LOCAL_DEV_TOKEN}`) || !context.env.LOCAL_DEV_ADMIN_EMAIL) return denied();
      context.data.cloudflareAccess = { JWT: { payload: { email: context.env.LOCAL_DEV_ADMIN_EMAIL } } };
      return context.next();
    }
    if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(context.env.ACCESS_DOMAIN ?? '') || !context.env.ACCESS_AUD || !context.env.ADMIN_EMAILS) return denied();
    return cloudflareAccessPlugin({ domain: context.env.ACCESS_DOMAIN as `https://${string}.cloudflareaccess.com`, aud: context.env.ACCESS_AUD })(context);
  },
  (context) => requireAdmin(context) ? context.next() : denied()
];
