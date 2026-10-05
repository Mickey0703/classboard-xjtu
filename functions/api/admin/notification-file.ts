import { denied, requireAdmin, type AdminData, type AdminEnv } from './auth';
import { downloadFile } from '../attachment-helpers';
export const onRequestGet: PagesFunction<AdminEnv, string, AdminData> = context => requireAdmin(context) ? downloadFile(context.env.DB, context.request, true) : denied();
