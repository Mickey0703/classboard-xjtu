import { downloadFile } from './attachment-helpers';
export const onRequestGet: PagesFunction<{ DB: D1Database }> = context => downloadFile(context.env.DB, context.request);
