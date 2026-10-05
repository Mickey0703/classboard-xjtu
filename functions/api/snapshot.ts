import type { EventItem, NotificationItem, Snapshot } from '../../src/domain/types';
import { attachmentLinks } from './attachment-helpers';

interface Env { DB: D1Database }
interface EventRow { id: string; title: string; description: string; category: string; start_at: string; due_at: string; done: number }
interface NotificationRow { id: string; kind: NotificationItem['kind']; priority: NotificationItem['priority']; title: string; body: string; due_at: string | null; pinned: number; published_at: string; photos?: string; requires_completion_proof?: number; attachments?: string }

export async function loadSnapshot(db: D1Database): Promise<Snapshot> {
  const [settings, eventRows, notificationRows] = await Promise.all([
    db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>(),
    db.prepare('SELECT * FROM events ORDER BY due_at').all<EventRow>(),
    db.prepare('SELECT * FROM notifications WHERE status = ? ORDER BY pinned DESC, published_at DESC').bind('published').all<NotificationRow>()
  ]);
  const values = Object.fromEntries((settings.results ?? []).map(({ key, value }) => [key, value]));
  const events: EventItem[] = (eventRows.results ?? []).map(row => ({ id: row.id, title: row.title, description: row.description, category: row.category, startAt: row.start_at, dueAt: row.due_at, done: Boolean(row.done) }));
  const notifications: NotificationItem[] = (notificationRows.results ?? []).map(row => ({ id: row.id, kind: row.kind, priority: row.priority, title: row.title, body: row.body, photos: JSON.parse(row.photos ?? '[]'), attachments: attachmentLinks(row.attachments, row.id), requiresCompletionProof: Boolean(row.requires_completion_proof), dueAt: row.due_at, pinned: Boolean(row.pinned), publishedAt: row.published_at }));
  return { className: values.className?.trim() || '西交班务', events, notifications, demo: values.demo === 'true' };
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try { return Response.json(await loadSnapshot(env.DB), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: '班务数据暂不可用' }, { status: 503 }); }
};
