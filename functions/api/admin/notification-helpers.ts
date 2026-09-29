import type { NotificationKind, NotificationPriority } from '../../../src/domain/types';
import { shanghaiTimestamp } from './validate';

export interface NotificationInput {
  id?: string; kind: NotificationKind; priority: NotificationPriority;
  title: string; body: string; dueAt: string | null; pinned: boolean;
}

export function validNotification(value: unknown): value is NotificationInput {
  if (!value || typeof value !== 'object') return false;
  const n = value as Partial<NotificationInput>;
  return ['notice', 'task'].includes(n.kind ?? '') && ['normal', 'important', 'urgent'].includes(n.priority ?? '') &&
    typeof n.title === 'string' && n.title.trim().length > 0 && n.title.length <= 120 &&
    typeof n.body === 'string' && n.body.trim().length > 0 && n.body.length <= 5000 &&
    typeof n.pinned === 'boolean' && (n.kind === 'task' ? shanghaiTimestamp(n.dueAt) : n.dueAt === null);
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function nowShanghai(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('Z', '+08:00');
}
