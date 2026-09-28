import { denied, requireAdmin, type AdminData, type AdminEnv } from './auth';

export const onRequestGet: PagesFunction<AdminEnv, string, AdminData> = context => {
  if (!requireAdmin(context)) return denied();
  return Response.json({ email: context.data.cloudflareAccess?.JWT?.payload?.email });
};
