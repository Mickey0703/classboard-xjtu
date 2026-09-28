import cloudflareAccessPlugin from '@cloudflare/pages-plugin-cloudflare-access';
import { denied, requireAdmin, type AdminData, type AdminEnv } from './auth';

export const onRequest: PagesFunction<AdminEnv, string, AdminData>[] = [
  (context) => {
    if (!context.env.ACCESS_DOMAIN || !context.env.ACCESS_AUD || !context.env.ADMIN_EMAILS) return denied();
    return cloudflareAccessPlugin({ domain: context.env.ACCESS_DOMAIN, aud: context.env.ACCESS_AUD })(context);
  },
  (context) => requireAdmin(context) ? context.next() : denied()
];
