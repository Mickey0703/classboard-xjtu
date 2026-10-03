import type { Photo } from './photos';
export interface EventItem {
  id: string; title: string; description: string; category: string;
  startAt: string; dueAt: string; done: boolean;
}
export type NotificationKind = 'notice' | 'task';
export type NotificationPriority = 'normal' | 'important' | 'urgent';
export type NotificationStatus = 'draft' | 'published' | 'withdrawn';
export interface NotificationItem {
  id: string; kind: NotificationKind; priority: NotificationPriority;
  title: string; body: string; dueAt: string | null; pinned: boolean; publishedAt: string;
  photos?: Photo[];
  requiresCompletionProof?: boolean;
}
export interface ClassMember { email: string; displayName: string; active: boolean }
export interface RecipientStatus { notificationId: string; acknowledgedAt: string | null; completedAt: string | null; photos?: Photo[] }
export interface Snapshot { className: string; events: EventItem[]; notifications: NotificationItem[]; demo: boolean }
export type EventStatus = 'done' | 'upcoming' | 'soon' | 'overdue';
