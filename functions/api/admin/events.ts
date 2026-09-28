import type { EventItem } from '../../../src/domain/types';
import { denied, invalid, requireAdmin, unavailable, type AdminData, type AdminEnv } from './auth';
import { validEvent } from './validate';

type Ctx = Parameters<PagesFunction<AdminEnv, string, AdminData>>[0];
async function save(context: Ctx, update: boolean): Promise<Response> {
  if (!requireAdmin(context)) return denied();
  let event: Partial<EventItem>;
  try { event = await context.request.json() as Partial<EventItem>; } catch { return invalid(); }
  if (!validEvent(event) || (update && !event.id)) return invalid();
  const id = update ? event.id! : crypto.randomUUID();
  try {
    const sql = update
      ? 'UPDATE events SET title=?, description=?, category=?, start_at=?, due_at=?, done=? WHERE id=?'
      : 'INSERT INTO events (title, description, category, start_at, due_at, done, id) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const result = await context.env.DB.prepare(sql).bind(event.title, event.description, event.category, event.startAt, event.dueAt, event.done ? 1 : 0, id).run();
    if (update && result.meta?.changes === 0) return Response.json({ error: '事项不存在' }, { status: 404 });
    return Response.json({ ...event, id });
  } catch { return unavailable(); }
}
export const onRequestPost: PagesFunction<AdminEnv, string, AdminData> = context => save(context, false);
export const onRequestPut: PagesFunction<AdminEnv, string, AdminData> = context => save(context, true);
export const onRequestDelete: PagesFunction<AdminEnv, string, AdminData> = async context => {
  if (!requireAdmin(context)) return denied();
  let id: unknown;
  try { id = (await context.request.json() as { id?: unknown }).id; } catch { return invalid(); }
  if (typeof id !== 'string' || !id) return invalid();
  try { await context.env.DB.prepare('DELETE FROM events WHERE id=?').bind(id).run(); return Response.json({ id }); }
  catch { return unavailable(); }
};
